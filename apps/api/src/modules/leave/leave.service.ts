/**
 * Leave Service — 有給休暇ビジネスロジック
 *
 * 処理フロー:
 * 1. 申請: 残日数チェック → leave_requestsにINSERT → ステータスpending
 * 2. 承認: leave_requestsをapprovedに → leave_balancesから先入先出で消化
 * 3. 却下: leave_requestsをrejectedに → 残日数変更なし
 *
 * セキュリティ: 社員は自分の申請のみ。承認はhas_approval=trueの役職のみ。
 *
 * 注意:
 * - 承認時のFIFO消化はトランザクション内で行う
 * - 消滅日を過ぎた有給は消化対象外
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 労基法第39条に基づく勤続年数別の有給付与日数
   * 通常労働者（週5日以上 or 週30時間以上）を前提
   */
  private laborLawLeaveDays(monthsOfService: number): number {
    if (monthsOfService < 6) return 0;
    if (monthsOfService < 18) return 10;
    if (monthsOfService < 30) return 11;
    if (monthsOfService < 42) return 12;
    if (monthsOfService < 54) return 14;
    if (monthsOfService < 66) return 16;
    if (monthsOfService < 78) return 18;
    return 20;
  }

  /**
   * 社員作成時の有給自動付与（L2）
   *
   * leaveGrantMethod に従って初期 leave_balance レコードを作成する。
   * - 'hire_date': 入社日基準で労基法の付与スケジュールに従って付与
   *   （6ヶ月未満は0日なのでレコード作成しない）
   * - 'transferred': 引継ぎ残日数をそのまま付与
   *
   * @param employeeId 社員UUID
   * @param opts 付与方式・入社日・引継ぎ情報
   */
  async grantInitialLeave(
    employeeId: string,
    opts: {
      grantMethod: 'hire_date' | 'transferred';
      hireDate: Date;
      transferredDays?: number;
      transferredGrantedDate?: Date;
    },
  ) {
    if (opts.grantMethod === 'transferred') {
      const days = opts.transferredDays ?? 0;
      if (days <= 0) return null;

      const grantedDate = opts.transferredGrantedDate ?? opts.hireDate;
      const expiryDate = new Date(grantedDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);

      return this.db.leaveBalance.create({
        data: {
          employeeId,
          grantedDate,
          expiryDate,
          grantedDays: days,
          usedDays: 0,
          remainingDays: days,
        },
      });
    }

    // hire_date 方式
    const today = new Date();
    const monthsOfService =
      (today.getFullYear() - opts.hireDate.getFullYear()) * 12 +
      (today.getMonth() - opts.hireDate.getMonth());

    const days = this.laborLawLeaveDays(monthsOfService);
    if (days <= 0) return null;

    // 最新の付与は基準日の属する勤続年数ロットで算出
    // grantedDate: 入社日から6ヶ月後、もしくは最新の年度付与日
    const grantedDate = new Date(opts.hireDate);
    grantedDate.setMonth(grantedDate.getMonth() + 6);
    // 6ヶ月を超えて年度が進んでいれば、最新の基準日に合わせる
    while (grantedDate <= today) {
      const next = new Date(grantedDate);
      next.setFullYear(next.getFullYear() + 1);
      if (next > today) break;
      grantedDate.setFullYear(grantedDate.getFullYear() + 1);
    }

    const expiryDate = new Date(grantedDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    return this.db.leaveBalance.create({
      data: {
        employeeId,
        grantedDate,
        expiryDate,
        grantedDays: days,
        usedDays: 0,
        remainingDays: days,
      },
    });
  }

  /**
   * 有給残日数を取得（消滅日が未来のロットのみ）
   */
  async getBalance(employeeId: string) {
    const today = new Date();
    const balances = await this.db.leaveBalance.findMany({
      where: {
        employeeId,
        expiryDate: { gte: today },
      },
      orderBy: { grantedDate: 'asc' },
    });

    const totalRemaining = balances.reduce(
      (sum, b) => sum + (Number(b.grantedDays) - Number(b.usedDays)),
      0,
    );

    return {
      remaining: totalRemaining,
      balances: balances.map((b) => ({
        id: b.id,
        grantedDate: b.grantedDate,
        expiryDate: b.expiryDate,
        grantedDays: Number(b.grantedDays),
        usedDays: Number(b.usedDays),
        remainingDays: Number(b.grantedDays) - Number(b.usedDays),
      })),
    };
  }

  /**
   * 有給申請を作成
   */
  async createRequest(
    employeeId: string,
    data: {
      leaveType: string;
      startDate: string;
      endDate: string;
      days: number;
      reason?: string;
    },
  ) {
    // 残日数チェック
    const balance = await this.getBalance(employeeId);
    if (data.days > balance.remaining) {
      throw new BadRequestException(
        `有給残日数が不足しています（残: ${balance.remaining}日, 申請: ${data.days}日）`,
      );
    }

    const result = await this.db.leaveRequest.create({
      data: {
        employeeId,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days: data.days,
        reason: data.reason,
        status: 'pending',
      },
    });

    this.notifications.notifyAdmins('有給休暇申請', '有給休暇申請が提出されました。').catch(() => {});

    return result;
  }

  /**
   * 有給申請を承認
   *
   * トランザクション内で:
   * 1. leave_requestsのステータスをapprovedに更新
   * 2. leave_balancesから先入先出（FIFO）で日数を消化
   *
   * FIFO消化の詳細:
   * - 付与日が古い順にsort
   * - 残日数がある最古のロットから消化
   * - 1ロットで足りなければ次のロットへ
   */
  async approveRequest(requestId: string, approverId: string) {
    const request = await this.db.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('申請が見つかりません');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('この申請は既に処理済みです');
    }

    // トランザクション: 承認 + FIFO消化
    await this.db.$transaction(async (tx) => {
      // 1. 申請を承認
      await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approverId,
          approvedAt: new Date(),
        },
      });

      // 2. FIFO消化
      const balances = await tx.leaveBalance.findMany({
        where: {
          employeeId: request.employeeId,
          expiryDate: { gte: new Date() },
        },
        orderBy: { grantedDate: 'asc' },
      });

      let remaining = Number(request.days);

      for (const balance of balances) {
        if (remaining <= 0) break;

        const available = Number(balance.grantedDays) - Number(balance.usedDays);
        if (available <= 0) continue;

        const deduct = Math.min(available, remaining);

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: Number(balance.usedDays) + deduct,
          },
        });

        remaining -= deduct;

        this.logger.log(
          `FIFO deduction: balance ${balance.id}, deducted ${deduct} days`,
        );
      }

      if (remaining > 0) {
        this.logger.error(
          `Insufficient leave balance after FIFO: ${remaining} days remaining`,
        );
      }
    });

    this.logger.log(`Leave request ${requestId} approved by ${approverId}`);

    this.notifications.create({ employeeId: request.employeeId, title: '有給休暇', body: '有給休暇申請が承認されました。' }).catch(() => {});
  }

  /**
   * 有給申請を却下
   */
  async rejectRequest(requestId: string, approverId: string, reason?: string) {
    const request = await this.db.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('申請が見つかりません');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('この申請は既に処理済みです');
    }

    await this.db.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        approverId,
        approvedAt: new Date(),
        rejectReason: reason,
      },
    });

    this.logger.log(`Leave request ${requestId} rejected by ${approverId}`);

    this.notifications.create({ employeeId: request.employeeId, title: '有給休暇', body: '有給休暇申請が却下されました。' }).catch(() => {});
  }

  /**
   * 承認待ちの有給申請一覧（管理者用）
   */
  async getPendingRequests() {
    return this.db.leaveRequest.findMany({
      where: { status: 'pending' },
      include: {
        employee: {
          select: {
            lastName: true,
            firstName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
