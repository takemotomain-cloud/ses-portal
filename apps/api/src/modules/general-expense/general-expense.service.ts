/**
 * GeneralExpense Service — 事前申請 + 一般経費申請
 *
 * フロー:
 * - manager/member: 事前申請 → 承認 → 経費申請（ペア必須）
 * - admin: 経費申請を直接提出（事前申請不要）
 * - employee (SES): 経費申請不可
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

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class GeneralExpenseService {
  private readonly logger = new Logger(GeneralExpenseService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== 事前申請 ====================

  async createPreApproval(
    employeeId: string,
    data: { expectedDate: string; description: string; estimatedAmount: number },
  ) {
    if (!data.expectedDate) throw new BadRequestException('発生予定日を入力してください');
    if (!data.description?.trim()) throw new BadRequestException('内容を入力してください');
    if (!Number.isFinite(data.estimatedAmount) || data.estimatedAmount <= 0) {
      throw new BadRequestException('見積金額は1円以上で入力してください');
    }

    const expectedDate = new Date(data.expectedDate);
    const today = startOfDay(new Date());
    if (expectedDate <= today) {
      throw new BadRequestException('発生予定日は未来日を指定してください');
    }

    return this.db.preApproval.create({
      data: {
        employeeId,
        expectedDate,
        description: data.description.trim(),
        estimatedAmount: Math.floor(data.estimatedAmount),
        status: 'pending',
      },
    });
  }

  async getMyPreApprovals(employeeId: string) {
    return this.db.preApproval.findMany({
      where: { employeeId },
      include: { generalExpenses: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 承認済みかつ未使用（経費申請とペアになっていない）の事前申請 */
  async getMyApprovedUnusedPreApprovals(employeeId: string) {
    return this.db.preApproval.findMany({
      where: {
        employeeId,
        status: 'approved',
        generalExpenses: { none: {} },
      },
      orderBy: { expectedDate: 'desc' },
    });
  }

  async getAllPreApprovals(status?: string) {
    const where: any = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }
    return this.db.preApproval.findMany({
      where,
      include: {
        employee: { select: { id: true, lastName: true, firstName: true, employeeCode: true } },
        generalExpenses: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approvePreApproval(id: string, approverEmployeeId: string, actorUserId?: string) {
    const pa = await this.db.preApproval.findUnique({ where: { id } });
    if (!pa) throw new NotFoundException('事前申請が見つかりません');
    if (pa.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');
    if (pa.employeeId === approverEmployeeId) throw new ForbiddenException('自分の申請は承認できません');

    await this.db.preApproval.update({
      where: { id },
      data: { status: 'approved', approverId: approverEmployeeId, approvedAt: new Date() },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'pre_approval.approve',
      targetTable: 'pre_approvals',
      targetId: id,
    });

    this.notifications.create({
      employeeId: pa.employeeId,
      title: '事前申請',
      body: '事前申請が承認されました。経費申請を提出できます。',
    }).catch(() => {});
  }

  async rejectPreApproval(id: string, approverEmployeeId: string, actorUserId?: string, reason?: string) {
    const pa = await this.db.preApproval.findUnique({ where: { id } });
    if (!pa) throw new NotFoundException('事前申請が見つかりません');
    if (pa.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');
    if (pa.employeeId === approverEmployeeId) throw new ForbiddenException('自分の申請は処理できません');

    await this.db.preApproval.update({
      where: { id },
      data: { status: 'rejected', approverId: approverEmployeeId, approvedAt: new Date(), rejectReason: reason || null },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'pre_approval.reject',
      targetTable: 'pre_approvals',
      targetId: id,
    });

    this.notifications.create({
      employeeId: pa.employeeId,
      title: '事前申請',
      body: '事前申請が却下されました。',
    }).catch(() => {});
  }

  // ==================== 経費申請 ====================

  async createExpense(
    employeeId: string,
    role: string,
    data: { expenseDate: string; description: string; amount: number; preApprovalId?: string },
    file?: Express.Multer.File,
  ) {
    // SES事業部（employeeロール）は経費申請不可
    if (role === 'employee') {
      throw new ForbiddenException('経費申請の権限がありません');
    }

    if (!data.expenseDate) throw new BadRequestException('利用日を入力してください');
    if (!data.description?.trim()) throw new BadRequestException('内容を入力してください');
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new BadRequestException('金額は1円以上で入力してください');
    }
    if (!file) throw new BadRequestException('領収書を添付してください');

    // 利用日バリデーション: 過去3ヶ月以内、未来日不可
    const expenseDate = new Date(data.expenseDate);
    const today = startOfDay(new Date());
    if (expenseDate > today) {
      throw new BadRequestException('利用日は過去の日付を指定してください');
    }
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (expenseDate < threeMonthsAgo) {
      throw new BadRequestException('利用日は過去3ヶ月以内で指定してください');
    }

    // admin以外は事前申請ペアが必須
    let preApprovalId: string | null = null;
    if (role !== 'admin') {
      if (!data.preApprovalId) {
        throw new BadRequestException('承認済みの事前申請を選択してください');
      }
      const pa = await this.db.preApproval.findUnique({
        where: { id: data.preApprovalId },
        include: { generalExpenses: { select: { id: true } } },
      });
      if (!pa) throw new NotFoundException('事前申請が見つかりません');
      if (pa.employeeId !== employeeId) throw new ForbiddenException('他人の事前申請は使用できません');
      if (pa.status !== 'approved') throw new BadRequestException('承認済みの事前申請のみ使用できます');
      if (pa.generalExpenses.length > 0) throw new BadRequestException('この事前申請は既に使用済みです');
      preApprovalId = pa.id;
    }

    const receiptPath = `/uploads/general-expense-receipts/${file.filename}`;
    const receiptName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const result = await this.db.generalExpense.create({
      data: {
        employeeId,
        preApprovalId,
        expenseDate,
        description: data.description.trim(),
        amount: Math.floor(data.amount),
        receiptPath,
        receiptName,
        status: 'pending',
      },
    });

    this.logger.log(`General expense created: ${result.id} (${data.amount}円)`);
    this.notifications.notifyAdmins('経費申請', '経費申請が提出されました。').catch(() => {});

    return result;
  }

  async getMyExpenses(employeeId: string) {
    return this.db.generalExpense.findMany({
      where: { employeeId },
      include: { preApproval: { select: { id: true, description: true, expectedDate: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllExpenses(status?: string) {
    const where: any = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }
    return this.db.generalExpense.findMany({
      where,
      include: {
        employee: { select: { id: true, lastName: true, firstName: true, employeeCode: true } },
        preApproval: { select: { id: true, description: true, expectedDate: true, estimatedAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveExpense(id: string, approverEmployeeId: string, actorUserId?: string) {
    const expense = await this.db.generalExpense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('経費申請が見つかりません');
    if (expense.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');
    if (expense.employeeId === approverEmployeeId) throw new ForbiddenException('自分の申請は承認できません');

    await this.db.generalExpense.update({
      where: { id },
      data: { status: 'approved', approverId: approverEmployeeId, approvedAt: new Date() },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'general_expense.approve',
      targetTable: 'general_expenses',
      targetId: id,
    });

    this.notifications.create({
      employeeId: expense.employeeId,
      title: '経費申請',
      body: '経費申請が承認されました。',
    }).catch(() => {});
  }

  async rejectExpense(id: string, approverEmployeeId: string, actorUserId?: string, reason?: string) {
    const expense = await this.db.generalExpense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('経費申請が見つかりません');
    if (expense.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');
    if (expense.employeeId === approverEmployeeId) throw new ForbiddenException('自分の申請は処理できません');

    await this.db.generalExpense.update({
      where: { id },
      data: { status: 'rejected', approverId: approverEmployeeId, approvedAt: new Date(), rejectReason: reason || null },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'general_expense.reject',
      targetTable: 'general_expenses',
      targetId: id,
    });

    this.notifications.create({
      employeeId: expense.employeeId,
      title: '経費申請',
      body: '経費申請が却下されました。',
    }).catch(() => {});
  }
}
