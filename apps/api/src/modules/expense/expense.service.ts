/**
 * Expense Service — 交通費申請ビジネスロジック
 *
 * 対応種別:
 *  - onetime         : 都度交通費（利用日ベース）
 *  - monthly_pass    : 1ヶ月定期（開始日〜終了日）
 *  - three_month_pass: 3ヶ月定期（開始日〜終了日）
 *
 * 処理フロー:
 *  1. 社員が明細行を添えて申請 → expense_requests + expense_items に INSERT
 *     - K2: 種別ごとの期間制約をバリデーション
 *     - K3: 金額の負数バリデーション
 *     - 定期の重複禁止
 *  2. 管理者が承認/却下 → ステータス更新
 *  3. 承認済みの経費は給与計算時に通勤手当として加算
 *
 * セキュリティ: 社員は自分の申請のみ。管理者は全社員を閲覧・承認可能。
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit-logs/audit.service';

type ExpenseKind = 'onetime' | 'monthly_pass' | 'three_month_pass';

interface ExpenseItemInput {
  kind?: ExpenseKind;       // 省略時は "onetime"
  expenseDate: string;      // 都度=利用日 / 定期=開始日
  passEndDate?: string;     // 定期のみ。省略時はkindから自動算出
  departure: string;
  destination: string;
  amount: number;
}

/** 日付ユーティリティ（ローカル Date 生成、UTCズレ回避） */
function parseDate(s: string): Date {
  // "YYYY-MM-DD" をローカルタイムの0:00として扱う
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

/** 月初（1日） */
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 月末 */
function lastOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** 定期券の終了日を開始日と種別から算出 */
function calcPassEndDate(startDate: Date, kind: ExpenseKind): Date {
  if (kind === 'monthly_pass') {
    // 開始日の1ヶ月後の前日
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return end;
  }
  if (kind === 'three_month_pass') {
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + 3);
    end.setDate(end.getDate() - 1);
    return end;
  }
  return startDate;
}

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 経費申請を作成（明細行を含む）
   *
   * トランザクション内で:
   *  1. 全明細をバリデーション（K2/K3・重複定期）
   *  2. expense_requests ヘッダーを INSERT
   *  3. expense_items の各行を INSERT
   *  4. 合計金額を計算してヘッダーに反映
   */
  async createRequest(employeeId: string, data: {
    targetMonth: string;
    items: ExpenseItemInput[];
  }, fileMap?: Map<number, Express.Multer.File>, tenantId: string = '') {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('明細が1件もありません');
    }

    const today = startOfDay(new Date());

    // --- 明細の正規化＋バリデーション ---
    const normalized = data.items.map((item, idx) => {
      const kind: ExpenseKind = (item.kind || 'onetime') as ExpenseKind;

      // K3: 負数バリデーション（0円以下は不可）
      if (!Number.isFinite(item.amount) || item.amount <= 0) {
        throw new BadRequestException(`明細 ${idx + 1}: 金額は1円以上で入力してください`);
      }

      if (!item.departure?.trim() || !item.destination?.trim()) {
        throw new BadRequestException(`明細 ${idx + 1}: 出発地・到着地を入力してください`);
      }

      const expenseDate = parseDate(item.expenseDate);

      // K2: 期間バリデーション
      if (kind === 'onetime') {
        // 都度: 利用日が過去3ヶ月以内、未来日不可
        if (expenseDate > today) {
          throw new BadRequestException(`明細 ${idx + 1}: 都度交通費の利用日に未来日は指定できません`);
        }
        const threeMonthsAgo = addMonths(today, -3);
        if (expenseDate < threeMonthsAgo) {
          throw new BadRequestException(`明細 ${idx + 1}: 都度交通費は利用日から3ヶ月以内のみ申請可能です`);
        }
      } else {
        // 定期: 開始日が「申請日の前月1日〜翌月末日」
        const earliest = firstOfMonth(addMonths(today, -1));  // 前月1日
        const latest = lastOfMonth(addMonths(today, 1));       // 翌月末日
        if (expenseDate < earliest || expenseDate > latest) {
          throw new BadRequestException(
            `明細 ${idx + 1}: 定期券の開始日は申請日の前月1日〜翌月末日の範囲で指定してください`,
          );
        }
      }

      // 定期券の終了日を算出（入力がある場合はそれを優先）
      const passEndDate = kind === 'onetime'
        ? null
        : (item.passEndDate ? parseDate(item.passEndDate) : calcPassEndDate(expenseDate, kind));

      // 領収書ファイル情報
      const file = fileMap?.get(idx);
      const receiptPath = file ? `/uploads/expense-receipts/${file.filename}` : null;
      const receiptName = file ? Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/^receipt_\d+_/, '') : null;

      return {
        kind,
        expenseDate,
        passEndDate,
        departure: item.departure.trim(),
        destination: item.destination.trim(),
        amount: Math.floor(item.amount),
        receiptPath,
        receiptName,
        sortOrder: idx,
      };
    });

    // --- 定期券の重複チェック（同社員の既存定期と期間が被らないこと） ---
    const passItems = normalized.filter(it => it.kind !== 'onetime');
    if (passItems.length > 0) {
      // 申請内の定期同士の重複
      for (let i = 0; i < passItems.length; i++) {
        for (let j = i + 1; j < passItems.length; j++) {
          if (overlaps(
            passItems[i].expenseDate, passItems[i].passEndDate!,
            passItems[j].expenseDate, passItems[j].passEndDate!,
          )) {
            throw new BadRequestException('申請内の定期券の期間が重複しています');
          }
        }
      }

      // 既存の承認済み・申請中の定期との重複
      const existingPasses = await this.db.expenseItem.findMany({
        where: {
          tenantId,
          kind: { in: ['monthly_pass', 'three_month_pass'] },
          expenseRequest: {
            employeeId,
            status: { in: ['pending', 'approved'] },
          },
        },
        select: { expenseDate: true, passEndDate: true },
      });

      for (const item of passItems) {
        for (const existing of existingPasses) {
          if (!existing.passEndDate) continue;
          if (overlaps(
            item.expenseDate, item.passEndDate!,
            existing.expenseDate, existing.passEndDate,
          )) {
            throw new BadRequestException('既に登録済みの定期券と期間が重複しています');
          }
        }
      }
    }

    const totalAmount = normalized.reduce((sum, item) => sum + item.amount, 0);

    const result = await this.db.$transaction(async (tx) => {
      const request = await tx.expenseRequest.create({
        data: {
          tenantId,
          employeeId,
          targetMonth: data.targetMonth,
          totalAmount,
          status: 'pending',
        },
      });

      await tx.expenseItem.createMany({
        data: normalized.map((item) => ({
          tenantId,
          expenseRequestId: request.id,
          kind: item.kind,
          expenseDate: item.expenseDate,
          passEndDate: item.passEndDate,
          departure: item.departure,
          destination: item.destination,
          amount: item.amount,
          receiptPath: item.receiptPath,
          receiptName: item.receiptName,
          sortOrder: item.sortOrder,
        })),
      });

      this.logger.log(`Expense request created: ${request.id} (${normalized.length} items, ${totalAmount}円)`);
      return request;
    });

    this.notifications.notifyAdmins(tenantId!, '交通費申請', 'が交通費申請を提出しました。', employeeId).catch(() => {});

    return result;
  }

  /**
   * 社員自身の経費申請一覧
   */
  async getMyRequests(employeeId: string, tenantId: string) {
    return this.db.expenseRequest.findMany({
      where: { employeeId, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 承認待ち一覧（管理者用）
   */
  async getPendingRequests(tenantId: string) {
    return this.db.expenseRequest.findMany({
      where: { tenantId, status: 'pending' },
      include: {
        employee: { select: { lastName: true, firstName: true, employeeCode: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 全ステータス経費一覧（管理者用・月別フィルタ）
   */
  async getAllRequests(targetMonth: string, status?: string, tenantId?: string) {
    const where: any = { targetMonth, tenantId };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }
    return this.db.expenseRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, lastName: true, firstName: true, employeeCode: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 階層承認チェック（E: 権限・ロール定義）
   *
   * approver と requester の employeeId / ロールから、承認/却下操作が許されるかを判定する。
   * セルフ承認禁止。member は controller で弾かれる想定だが防御的にここでも拒否する。
   */
  private async assertCanActOnRequest(
    requesterEmployeeId: string,
    approverEmployeeId: string,
    approverRole: string,
    tenantId: string,
  ): Promise<void> {
    // セルフ承認禁止
    if (requesterEmployeeId === approverEmployeeId) {
      throw new ForbiddenException('自分の申請は自分で処理できません');
    }

    // 申請者の User ロールを取得（User レコードが無い場合は 'employee' とみなす）
    const requesterUser = await this.db.user.findFirst({
      where: { employeeId: requesterEmployeeId, tenantId },
      select: { role: true },
    });
    const requesterRole = requesterUser?.role ?? 'employee';

    if (approverRole === 'admin') {
      return; // admin は全員処理可
    }
    if (approverRole === 'manager') {
      // manager は admin / 他 manager の申請を処理できない
      if (requesterRole === 'admin' || requesterRole === 'manager') {
        throw new ForbiddenException('この申請を処理する権限がありません');
      }
      return;
    }
    // member / employee など
    throw new ForbiddenException('この申請を処理する権限がありません');
  }

  /**
   * 承認
   */
  async approve(
    requestId: string,
    approverEmployeeId: string,
    tenantId: string,
    actorUserId?: string,
    approverRole?: string,
  ) {
    const request = await this.db.expenseRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('経費申請が見つかりません');
    if (request.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');

    await this.assertCanActOnRequest(request.employeeId, approverEmployeeId, approverRole ?? 'admin', tenantId);

    await this.db.expenseRequest.updateMany({
      where: { id: requestId, tenantId },
      data: { status: 'approved', approverId: approverEmployeeId, approvedAt: new Date() },
    });

    this.logger.log(`Expense request ${requestId} approved by ${approverEmployeeId}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'expense.approve',
      targetTable: 'expense_requests',
      targetId: requestId,
      newValue: {
        employeeId: request.employeeId,
        targetMonth: request.targetMonth,
        totalAmount: request.totalAmount,
      },
    });

    this.notifications.create({ tenantId, employeeId: request.employeeId, title: '交通費', body: '交通費申請が承認されました。' }).catch(() => {});
  }

  /**
   * 却下
   */
  async reject(
    requestId: string,
    approverEmployeeId: string,
    tenantId: string,
    actorUserId?: string,
    approverRole?: string,
    reason?: string,
  ) {
    const request = await this.db.expenseRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!request) throw new NotFoundException('経費申請が見つかりません');
    if (request.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');

    await this.assertCanActOnRequest(request.employeeId, approverEmployeeId, approverRole ?? 'admin', tenantId);

    await this.db.expenseRequest.updateMany({
      where: { id: requestId, tenantId },
      data: {
        status: 'rejected',
        approverId: approverEmployeeId,
        approvedAt: new Date(),
        rejectReason: reason || null,
      },
    });

    this.logger.log(`Expense request ${requestId} rejected by ${approverEmployeeId}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'expense.reject',
      targetTable: 'expense_requests',
      targetId: requestId,
      newValue: {
        employeeId: request.employeeId,
        targetMonth: request.targetMonth,
        totalAmount: request.totalAmount,
      },
    });

    this.notifications.create({ tenantId, employeeId: request.employeeId, title: '交通費', body: '交通費申請が却下されました。' }).catch(() => {});
  }
}

/** 期間 [aStart, aEnd] と [bStart, bEnd] が重なるか（両端含む） */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
