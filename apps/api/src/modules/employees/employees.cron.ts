/**
 * Employees Cron
 *
 * 退職日を過ぎた社員を自動的に status='resigned' に更新する日次バッチ。
 * 退職日翌日0時から退職扱い（境界B）。
 *
 * 冪等な UPDATE なので ECS Fargate の複数タスクで同時実行されてもOK。
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class EmployeesCron {
  private readonly logger = new Logger(EmployeesCron.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 毎日 00:00 に実行
   * resign_date < 今日 のアクティブ社員を退職扱いに更新
   * （= 退職日翌日0時から resigned）
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoResign(): Promise<void> {
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
  }
}
