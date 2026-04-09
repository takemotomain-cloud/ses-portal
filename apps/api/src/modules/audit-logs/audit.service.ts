/**
 * Audit Service — 監査ログ共通ヘルパー（T2）
 *
 * 各サービスが `this.auditService.log(...)` を呼ぶことで、
 * AuditLog テーブルに統一フォーマットで記録する。
 *
 * 記録対象（決定事項 T2）:
 *   - 認証系: login_success / login_failure / logout / sso_link
 *   - 社員情報: create / update / soft_delete / restore
 *   - 給与・経費: payroll.confirm / payroll.edit / expense.approve / expense.reject
 *   - 権限変更: user.role_change
 *   - 機密情報閲覧: pii.mynumber_view / pii.bank_view
 *   - ファイルエクスポート: export.csv / export.pdf
 *
 * log() は失敗しても例外を投げず、warn ログだけ残して呼び出し元に影響させない。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  targetTable: string;
  targetId?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.db.auditLog.create({
        data: {
          userId: input.userId ?? undefined,
          action: input.action.slice(0, 50),
          targetTable: input.targetTable.slice(0, 100),
          targetId: input.targetId ?? undefined,
          oldValue: input.oldValue !== undefined ? (input.oldValue as any) : undefined,
          newValue: input.newValue !== undefined ? (input.newValue as any) : undefined,
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
      });
    } catch (err: any) {
      // 監査ログの失敗で業務処理を止めたくないので warn に留める
      this.logger.warn(`audit log write failed: ${err?.message ?? err}`);
    }
  }

  /**
   * 監査ログの一覧取得（管理画面「操作ログ」タブで使用）
   */
  async findAll(params: { limit?: number; offset?: number; action?: string; userId?: string } = {}) {
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 200) : 100;
    const offset = params.offset && params.offset > 0 ? params.offset : 0;
    const where: any = {};
    if (params.action) where.action = params.action;
    if (params.userId) where.userId = params.userId;

    const [rows, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              employee: { select: { lastName: true, firstName: true, email: true } },
            },
          },
        },
      }),
      this.db.auditLog.count({ where }),
    ]);

    return {
      total,
      rows: rows.map((r: any) => ({
        id: r.id,
        action: r.action,
        targetTable: r.targetTable,
        targetId: r.targetId,
        oldValue: r.oldValue,
        newValue: r.newValue,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        userEmail: r.user?.employee?.email ?? null,
        userName: r.user?.employee ? `${r.user.employee.lastName} ${r.user.employee.firstName}` : null,
      })),
    };
  }
}
