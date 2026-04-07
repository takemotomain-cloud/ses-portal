/**
 * Auto-Notification Service
 *
 * 自動通知ルールのCRUD管理 + cronベースの自動実行。
 * - スケジュール（cron）: 毎分チェックし、該当ルールの通知を生成
 * - イベント: 他モジュールから handleEvent() を呼び出して通知を生成
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from './notifications.service';

interface CreateRuleDto {
  name: string;
  triggerType: 'cron' | 'event';
  triggerConfig?: Record<string, any>;
  targetType: 'all' | 'department' | 'area' | 'individual' | 'affected';
  titleTemplate: string;
  bodyTemplate: string;
  isEnabled?: boolean;
}

interface UpdateRuleDto {
  name?: string;
  triggerType?: 'cron' | 'event';
  triggerConfig?: Record<string, any>;
  targetType?: 'all' | 'department' | 'area' | 'individual' | 'affected';
  titleTemplate?: string;
  bodyTemplate?: string;
  isEnabled?: boolean;
}

@Injectable()
export class AutoNotificationService {
  private readonly logger = new Logger(AutoNotificationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /* ==============================================
   * CRUD
   * ============================================== */

  async findAll() {
    return this.db.autoNotificationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rule = await this.db.autoNotificationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('ルールが見つかりません');
    return rule;
  }

  async create(data: CreateRuleDto) {
    if (!['cron', 'event'].includes(data.triggerType)) {
      throw new BadRequestException('triggerType は cron または event を指定してください');
    }
    if (!['all', 'department', 'area', 'individual', 'affected'].includes(data.targetType)) {
      throw new BadRequestException('targetType が不正です');
    }
    if (data.triggerType === 'cron') {
      const cronExpr = data.triggerConfig?.cronExpression;
      if (!cronExpr || typeof cronExpr !== 'string') {
        throw new BadRequestException('cronルールには triggerConfig.cronExpression が必要です');
      }
    }
    if (data.triggerType === 'event') {
      const eventName = data.triggerConfig?.eventName;
      if (!eventName || typeof eventName !== 'string') {
        throw new BadRequestException('eventルールには triggerConfig.eventName が必要です');
      }
    }

    return this.db.autoNotificationRule.create({
      data: {
        name: data.name,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig || {},
        targetType: data.targetType,
        titleTemplate: data.titleTemplate,
        bodyTemplate: data.bodyTemplate,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  async update(id: string, data: UpdateRuleDto) {
    await this.findOne(id); // existence check
    return this.db.autoNotificationRule.update({
      where: { id },
      data,
    });
  }

  async toggleEnabled(id: string, isEnabled: boolean) {
    await this.findOne(id);
    return this.db.autoNotificationRule.update({
      where: { id },
      data: { isEnabled },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.autoNotificationRule.delete({ where: { id } });
  }

  /* ==============================================
   * Cron 実行（毎分チェック）
   * ============================================== */

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronTick() {
    const rules = await this.db.autoNotificationRule.findMany({
      where: { isEnabled: true, triggerType: 'cron' },
    });

    const now = new Date();

    for (const rule of rules) {
      try {
        const config = rule.triggerConfig as Record<string, any> | null;
        const cronExpr = config?.cronExpression as string | undefined;
        if (!cronExpr) continue;

        if (!this.matchesCron(cronExpr, now)) continue;

        // 重複実行防止: 同じ分に既に実行済みなら skip
        if (rule.lastExecutedAt) {
          const lastMin = new Date(rule.lastExecutedAt);
          if (
            lastMin.getFullYear() === now.getFullYear() &&
            lastMin.getMonth() === now.getMonth() &&
            lastMin.getDate() === now.getDate() &&
            lastMin.getHours() === now.getHours() &&
            lastMin.getMinutes() === now.getMinutes()
          ) {
            continue;
          }
        }

        await this.executeRule(rule);
      } catch (err) {
        this.logger.error(`ルール実行エラー [${rule.name}]: ${err}`);
      }
    }
  }

  /* ==============================================
   * イベントフック（将来用）
   * ============================================== */

  async handleEvent(eventName: string, context: { employeeId?: string; [key: string]: any }) {
    const rules = await this.db.autoNotificationRule.findMany({
      where: {
        isEnabled: true,
        triggerType: 'event',
      },
    });

    for (const rule of rules) {
      const config = rule.triggerConfig as Record<string, any> | null;
      if (config?.eventName !== eventName) continue;

      try {
        if (rule.targetType === 'affected' && context.employeeId) {
          const title = this.resolveTemplate(rule.titleTemplate, context);
          const body = this.resolveTemplate(rule.bodyTemplate, context);
          await this.notificationsService.create({
            employeeId: context.employeeId,
            title,
            body,
            category: 'auto_notification',
          });
        } else {
          await this.executeRule(rule, context);
        }

        await this.db.autoNotificationRule.update({
          where: { id: rule.id },
          data: { lastExecutedAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`イベントルール実行エラー [${rule.name}]: ${err}`);
      }
    }
  }

  /* ==============================================
   * 内部メソッド
   * ============================================== */

  private async executeRule(
    rule: { id: string; name: string; targetType: string; titleTemplate: string; bodyTemplate: string; triggerConfig: any },
    context: Record<string, any> = {},
  ) {
    const employeeIds = await this.resolveTargetEmployees(rule.targetType, rule.triggerConfig);

    if (employeeIds.length === 0) {
      this.logger.warn(`ルール [${rule.name}]: 対象社員なし`);
      return;
    }

    const now = new Date();
    const baseContext: Record<string, any> = {
      date: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      monthEnd: `${now.getFullYear()}年${now.getMonth() + 1}月末`,
      ...context,
    };

    for (const empId of employeeIds) {
      const emp = await this.db.employee.findUnique({
        where: { id: empId },
        select: { lastName: true, firstName: true },
      });

      const empContext = {
        ...baseContext,
        employeeName: emp ? `${emp.lastName} ${emp.firstName}` : '',
      };

      const title = this.resolveTemplate(rule.titleTemplate, empContext);
      const body = this.resolveTemplate(rule.bodyTemplate, empContext);

      await this.notificationsService.create({
        employeeId: empId,
        title,
        body,
        category: 'auto_notification',
      });
    }

    await this.db.autoNotificationRule.update({
      where: { id: rule.id },
      data: { lastExecutedAt: new Date() },
    });

    this.logger.log(`ルール [${rule.name}] 実行完了: ${employeeIds.length}名に通知`);
  }

  private async resolveTargetEmployees(targetType: string, triggerConfig: any): Promise<string[]> {
    const config = triggerConfig as Record<string, any> | null;

    switch (targetType) {
      case 'all': {
        const emps = await this.db.employee.findMany({
          where: { deletedAt: null, status: { not: 'resigned' } },
          select: { id: true },
        });
        return emps.map(e => e.id);
      }

      case 'department': {
        const deptIds = config?.departmentIds as string[] | undefined;
        if (!deptIds?.length) return [];
        const emps = await this.db.employee.findMany({
          where: { deletedAt: null, status: { not: 'resigned' }, departmentId: { in: deptIds } },
          select: { id: true },
        });
        return emps.map(e => e.id);
      }

      case 'area': {
        const area = config?.area as string | undefined;
        if (!area) return [];
        const assignments = await this.db.assignment.findMany({
          where: { area, status: 'active' },
          select: { employeeId: true },
          distinct: ['employeeId'],
        });
        return assignments.map(a => a.employeeId);
      }

      case 'individual': {
        return (config?.employeeIds as string[]) || [];
      }

      case 'affected': {
        // 特殊ケース: checkType に応じて対象を動的取得
        const checkType = config?.checkType as string | undefined;
        if (checkType === 'contract_ending_soon') {
          const daysBeforeEnd = (config?.daysBeforeEnd as number) || 30;
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + daysBeforeEnd);
          const assignments = await this.db.assignment.findMany({
            where: {
              status: 'active',
              endDate: { lte: deadline },
            },
            select: { employeeId: true },
            distinct: ['employeeId'],
          });
          return assignments.map(a => a.employeeId);
        }
        return [];
      }

      default:
        return [];
    }
  }

  private resolveTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return context[key] !== undefined ? String(context[key]) : `{{${key}}}`;
    });
  }

  /**
   * 簡易cronマッチング
   * cron形式: "分 時 日 月 曜日" (5フィールド)
   */
  private matchesCron(expr: string, now: Date): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [minExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;
    const minute = now.getMinutes();
    const hour = now.getHours();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const dow = now.getDay(); // 0=Sun

    return (
      this.matchField(minExpr, minute) &&
      this.matchField(hourExpr, hour) &&
      this.matchField(dayExpr, day) &&
      this.matchField(monthExpr, month) &&
      this.matchField(dowExpr, dow)
    );
  }

  private matchField(expr: string, value: number): boolean {
    if (expr === '*') return true;

    // */N (step)
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2), 10);
      return !isNaN(step) && step > 0 && value % step === 0;
    }

    // comma-separated values
    const parts = expr.split(',');
    for (const part of parts) {
      // range: N-M
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (value >= start && value <= end) return true;
      } else {
        if (parseInt(part, 10) === value) return true;
      }
    }

    return false;
  }
}
