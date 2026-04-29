/**
 * Work Rules Service
 *
 * 就業規則のビジネスロジック。
 *
 * 社員側: is_current=TRUE の1レコードを返す。
 * 管理側: 編集→保存→公開のフロー（is_currentの排他制御）。
 *
 * 注意: is_current=TRUEは常に1レコードのみ。
 * 公開時にトランザクションで旧版FALSE→新版TRUEにする。
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class WorkRulesService {
  private readonly logger = new Logger(WorkRulesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 現行版を取得（社員側で使用）
   */
  async getCurrent() {
    const rule = await this.db.workRule.findFirst({
      where: { isCurrent: true },
    });

    if (!rule) {
      throw new NotFoundException('就業規則が登録されていません');
    }

    return {
      id: rule.id,
      version: rule.version,
      effectiveDate: rule.effectiveDate,
      content: rule.content,
      memo: rule.memo,
    };
  }

  /**
   * 改定履歴一覧
   */
  async getHistory() {
    return this.db.workRule.findMany({
      select: {
        id: true,
        version: true,
        effectiveDate: true,
        memo: true,
        isCurrent: true,
        createdAt: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  /**
   * 新バージョンを公開
   *
   * トランザクション内で:
   * 1. 全レコードのis_currentをFALSEに
   * 2. 新レコードをis_current=TRUEで作成
   */
  async publish(data: {
    version: string;
    effectiveDate: string;
    content: any;
    memo?: string;
    publishedBy: string;
  }) {
    return this.db.$transaction(async (tx) => {
      // 旧版を全部FALSEに
      await tx.workRule.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });

      // 新版を作成
      const newRule = await tx.workRule.create({
        data: {
          version: data.version,
          effectiveDate: new Date(data.effectiveDate),
          content: data.content,
          memo: data.memo,
          isCurrent: true,
          publishedBy: data.publishedBy,
        },
      });

      this.logger.log(`Work rules ${data.version} published by ${data.publishedBy}`);

      return newRule;
    });
  }
}
