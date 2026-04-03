/**
 * Assignments Service
 *
 * 稼働情報のビジネスロジック。
 *
 * 社員向けAPI:
 * - 現在の稼働先（status=active のレコード）
 * - 稼働ヒストリー（全レコード、新しい順）
 *
 * セキュリティ: 社員は自分のアサインのみ閲覧可能。
 * 単価・還元率は社員に公開する設計（SES業界の慣行）。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 現在の稼働先を取得
   *
   * status=active のアサインを返す。
   * クライアント情報（会社名・連絡先）もJOINで取得。
   * アサインがない場合はnullを返す（エラーにはしない）。
   */
  async getCurrentAssignment(employeeId: string) {
    return this.db.assignment.findFirst({
      where: {
        employeeId,
        status: 'active',
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            industry: true,
            contactPerson: true,
          },
        },
      },
    });
  }

  /**
   * 稼働ヒストリーを取得
   *
   * 全アサイン（終了済み含む）を開始日の新しい順で返す。
   * パフォーマンス: 1社員のアサイン数は通常10件以下なのでページネーション不要。
   */
  async getHistory(employeeId: string) {
    return this.db.assignment.findMany({
      where: {
        employeeId,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
