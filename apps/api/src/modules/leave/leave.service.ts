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

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(private readonly db: DatabaseService) {}

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

    return this.db.leaveRequest.create({
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
