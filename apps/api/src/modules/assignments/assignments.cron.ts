/**
 * Assignments Cron
 *
 * M2: アサインの endDate を過ぎたレコードを自動的に status='ended' に更新する。
 *
 * 実行タイミング: 毎日 09:00 JST（cron 運用決定事項 B5 に準拠）
 * 冪等な UPDATE なので複数インスタンスで同時実行されてもOK。
 *
 * T1: 失敗時は管理者に通知（decision T1）。
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AssignmentsCron {
  private readonly logger = new Logger(AssignmentsCron.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 毎日 09:00 JST 実行
   * endDate < 今日 のアクティブアサインを ended に更新
   */
  @Cron('0 0 9 * * *', { timeZone: 'Asia/Tokyo' })
  async autoEndExpiredAssignments(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await this.db.assignment.updateMany({
        where: {
          status: { in: ['active', 'ending_scheduled'] },
          endDate: { lt: today, not: null },
          deletedAt: null,
        },
        data: {
          status: 'ended',
          endReason: 'term_expired',
        },
      });

      if (result.count > 0) {
        this.logger.log(`M2: endDate 経過アサインを自動終了: ${result.count} 件`);
      }
    } catch (err: any) {
      this.logger.error(`autoEndExpiredAssignments cron 失敗: ${err?.message ?? err}`, err?.stack);
      try {
        await this.notificationsService.notifyAdmins(
          '[cron失敗] アサイン自動終了',
          `assignments.cron の autoEndExpiredAssignments で例外が発生しました: ${err?.message ?? err}`,
        );
      } catch (notifyErr: any) {
        this.logger.error(`管理者通知も失敗: ${notifyErr?.message ?? notifyErr}`);
      }
    }
  }
}
