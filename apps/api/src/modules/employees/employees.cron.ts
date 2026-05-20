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

      // 1. 一般社員の自動退職処理（全テナント一括）
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

      // 2. admin 社員が退職日超過でまだ active なケースを抽出
      const skippedAdmins = await this.db.employee.findMany({
        where: {
          status: 'active',
          resignDate: { lt: today, not: null },
          deletedAt: null,
          user: { role: 'admin' },
        },
        select: {
          id: true,
          tenantId: true,
          employeeCode: true,
          lastName: true,
          firstName: true,
          resignDate: true,
        },
      });

      if (skippedAdmins.length > 0) {
        // テナントごとにグルーピングして通知
        const adminsByTenant = new Map<string, typeof skippedAdmins>();
        for (const e of skippedAdmins) {
          const list = adminsByTenant.get(e.tenantId) || [];
          list.push(e);
          adminsByTenant.set(e.tenantId, list);
        }

        for (const [tenantId, list] of adminsByTenant.entries()) {
          this.logger.warn(
            `[Tenant:${tenantId}] adminユーザーの自動退職をスキップしました: ${list.map((e) => e.employeeCode).join(', ')}`,
          );
          try {
            await this.notificationsService.notifyAdmins(
              tenantId,
              '[要対応] 退職日超過のadminユーザー',
              `以下のadminユーザーが退職日を超過していますが、自動退職処理はスキップされました。\n別のユーザーをadminに昇格してから手動で退職処理を行ってください。\n\n${list
                .map((e) => `- ${e.employeeCode} ${e.lastName} ${e.firstName}（退職日: ${e.resignDate?.toISOString().slice(0, 10)}）`)
                .join('\n')}`,
            );
          } catch (notifyErr: any) {
            this.logger.error(`[Tenant:${tenantId}] admin 退職スキップ通知失敗: ${notifyErr?.message ?? notifyErr}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`autoResign cron 失敗: ${err?.message ?? err}`, err?.stack);
      // 全体失敗時の通知（特定のテナントに依存しないエラーの場合、全てのテナント管理者、またはシステム管理者に通知したいが
      // 現状はログ出力に留めるか、全テナントをループして通知する。ここでは全テナントへの通知を試行）
      try {
        const tenants = await this.db.tenant.findMany({ select: { id: true } });
        for (const t of tenants) {
          await this.notificationsService.notifyAdmins(
            t.id,
            '[システム通知] 自動退職バッチ失敗',
            `システム全体の自動退職処理でエラーが発生しました。エンジニアに確認を依頼してください。\nエラー: ${err?.message ?? err}`,
          );
        }
      } catch (notifyErr: any) {
        this.logger.error(`システム全体失敗の通知も失敗: ${notifyErr?.message ?? notifyErr}`);
      }
    }
  }
}
