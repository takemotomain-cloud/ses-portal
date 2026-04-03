/**
 * Expense Service — 経費精算ビジネスロジック
 *
 * 処理フロー:
 * 1. 社員が明細行を添えて申請 → expense_requests + expense_items に INSERT
 * 2. 管理者が承認/却下 → ステータス更新
 * 3. 承認済みの経費は給与計算時に通勤手当として加算
 *
 * セキュリティ: 社員は自分の申請のみ。管理者は全社員を閲覧・承認可能。
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

interface ExpenseItemInput {
  expenseDate: string;
  departure: string;
  destination: string;
  amount: number;
}

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 経費申請を作成（明細行を含む）
   *
   * トランザクション内で:
   * 1. expense_requestsヘッダーをINSERT
   * 2. expense_itemsの各行をINSERT
   * 3. 合計金額を計算してヘッダーに反映
   */
  async createRequest(employeeId: string, data: {
    targetMonth: string;
    items: ExpenseItemInput[];
  }) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('明細が1件もありません');
    }

    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

    return this.db.$transaction(async (tx) => {
      const request = await tx.expenseRequest.create({
        data: {
          employeeId,
          targetMonth: data.targetMonth,
          totalAmount,
          status: 'pending',
        },
      });

      await tx.expenseItem.createMany({
        data: data.items.map((item, idx) => ({
          expenseRequestId: request.id,
          expenseDate: new Date(item.expenseDate),
          departure: item.departure,
          destination: item.destination,
          amount: item.amount,
          sortOrder: idx,
        })),
      });

      this.logger.log(`Expense request created: ${request.id} (${data.items.length} items, ${totalAmount}円)`);
      return request;
    });
  }

  /**
   * 社員自身の経費申請一覧
   */
  async getMyRequests(employeeId: string) {
    return this.db.expenseRequest.findMany({
      where: { employeeId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 承認待ち一覧（管理者用）
   */
  async getPendingRequests() {
    return this.db.expenseRequest.findMany({
      where: { status: 'pending' },
      include: {
        employee: { select: { lastName: true, firstName: true, employeeCode: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 承認
   */
  async approve(requestId: string, approverId: string) {
    const request = await this.db.expenseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('経費申請が見つかりません');
    if (request.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');

    await this.db.expenseRequest.update({
      where: { id: requestId },
      data: { status: 'approved', approverId, approvedAt: new Date() },
    });

    this.logger.log(`Expense request ${requestId} approved by ${approverId}`);
  }

  /**
   * 却下
   */
  async reject(requestId: string, approverId: string) {
    const request = await this.db.expenseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('経費申請が見つかりません');
    if (request.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');

    await this.db.expenseRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', approverId, approvedAt: new Date() },
    });

    this.logger.log(`Expense request ${requestId} rejected by ${approverId}`);
  }
}
