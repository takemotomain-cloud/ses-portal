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

      // E: 最後の admin 保護 — admin ロールの社員は cron 自動退職の対象外
      // （万が一退職日が過ぎていても、明示的な UI 操作＋降格を要求する）
      const result = await this.db.employee.updateMany({
        where: {
          status: 'active',
          resignDate: { lt: today, not: null },
          deletedAt: null,
          OR: [
            { user: null },
            { user: { role: { not: 'admin' } } },
          ],
        },
        data: { status: 'resigned' },
      });

      if (result.count > 0) {
        this.logger.log(`自動退職処理: ${result.count}名を resigned に更新しました`);
      }

      // admin 社員が退職日超過でまだ active なら管理者に通知
      const skippedAdmins = await this.db.employee.findMany({
        where: {
          status: 'active',
          resignDate: { lt: today, not: null },
          deletedAt: null,
          user: { role: 'admin' },
        },
        select: {
          id: true,
          employeeCode: true,
          lastName: true,
          firstName: true,
          resignDate: true,
        },
      });
      if (skippedAdmins.length > 0) {
        this.logger.warn(
          `adminユーザーの自動退職をスキップしました: ${skippedAdmins.map((e) => e.employeeCode).join(', ')}`,
        );
        try {
          await this.notificationsService.notifyAdmins(
            '[要対応] 退職日超過のadminユーザー',
            `以下のadminユーザーが退職日を超過していますが、自動退職処理はスキップされました。\n別のユーザーをadminに昇格してから手動で退職処理を行ってください。\n\n${skippedAdmins
              .map((e) => `- ${e.employeeCode} ${e.lastName} ${e.firstName}（退職日: ${e.resignDate?.toISOString().slice(0, 10)}）`)
              .join('\n')}`,
          );
        } catch (notifyErr: any) {
          this.logger.error(`admin 退職スキップ通知も失敗: ${notifyErr?.message ?? notifyErr}`);
        }
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
