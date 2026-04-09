/**
 * Employees Cron
 *
 * 退職日を過ぎた社員を自動的に status='resigned' に更新する日次バッチ。
 * 退職日翌日0時から退職扱い（境界B）。
 *
 * 冪等な UPDATE なので ECS Fargate の複数タスクで同時実行されてもOK。
 *
 * T1: 失敗時は管理者に通知（decision T1）。
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EmployeesCron {
  private readonly logger = new Logger(EmployeesCron.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 毎日 00:00 に実行
   * resign_date < 今日 のアクティブ社員を退職扱いに更新
   * （= 退職日翌日0時から resigned）
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoResign(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await this.db.employee.updateMany({
        where: {
          status: 'active',
          resignDate: { lt: today, not: null },
          deletedAt: null,
        },
        data: { status: 'resigned' },
      });

      if (result.count > 0) {
        this.logger.log(`自動退職処理: ${result.count}名を resigned に更新しました`);
      }
    } catch (err: any) {
      this.logger.error(`autoResign cron 失敗: ${err?.message ?? err}`, err?.stack);
      try {
        await this.notificationsService.notifyAdmins(
          '[cron失敗] 自動退職処理',
          `employees.cron の autoResign で例外が発生しました: ${err?.message ?? err}`,
        );
      } catch (notifyErr: any) {
        this.logger.error(`管理者通知も失敗: ${notifyErr?.message ?? notifyErr}`);
      }
    }
  }
}
