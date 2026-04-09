/**
 * Users Service — ロール変更ビジネスロジック（E: 権限・ロール定義）
 *
 * `PATCH /users/:id/role` のバックエンドロジック。
 *
 * 許容ロール: admin | manager | member | employee
 * - admin: 管理側ログイン。全権限。
 * - manager: 管理側ログイン。admin/他 manager の給与不可視。
 * - member: 管理側ログイン。admin/manager/他 member の給与不可視。
 * - employee: 管理側非ログイン。SES 事業部など /mypage のみ。
 *
 * 「最後の admin 保護」ルール:
 *   - admin を admin 以外に降格する場合、`count(role='admin' && employee.deletedAt IS NULL)` が
 *     1 以下ならエラーにする。セルフ降格も同じチェック。
 *   - cron / 退職処理側の論理削除も employees.service.ts 側で同じ count を実施する。
 *
 * 監査ログ: `user.role_change`（oldValue/newValue: { role: string }）を記録する。
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit-logs/audit.service';

const ALLOWED_ROLES = ['admin', 'manager', 'member', 'employee'] as const;
export type UserRole = (typeof ALLOWED_ROLES)[number];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * ロール変更（admin 専用、最後の admin 保護付き）
   *
   * @param targetUserId 変更対象の User.id
   * @param newRole      新しいロール
   * @param actorUserId  操作者の User.id（監査ログ用）
   */
  async changeRole(
    targetUserId: string,
    newRole: string,
    actorUserId?: string,
  ): Promise<{ id: string; role: string }> {
    if (!ALLOWED_ROLES.includes(newRole as UserRole)) {
      throw new BadRequestException(
        `許容されないロールです（${ALLOWED_ROLES.join(', ')} のいずれかを指定してください）`,
      );
    }

    const target = await this.db.user.findUnique({
      where: { id: targetUserId },
      include: {
        employee: {
          select: { id: true, deletedAt: true, lastName: true, firstName: true, employeeCode: true },
        },
      },
    });

    if (!target) {
      throw new NotFoundException('ユーザーが見つかりません');
    }
    if (target.employee?.deletedAt) {
      throw new BadRequestException('削除済み社員のロールは変更できません');
    }

    const oldRole = target.role;

    // 同じロールなら何もしない
    if (oldRole === newRole) {
      return { id: target.id, role: oldRole };
    }

    // 最後の admin 保護: admin → admin 以外 のとき
    if (oldRole === 'admin' && newRole !== 'admin') {
      const activeAdminCount = await this.db.user.count({
        where: {
          role: 'admin',
          employee: { deletedAt: null },
        },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          '最後のadminを降格することはできません。別のユーザーをadminに昇格してから降格してください。',
        );
      }
    }

    const updated = await this.db.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    this.logger.log(
      `ロール変更: ${target.employee?.employeeCode ?? '?'} ${target.employee?.lastName ?? ''}${target.employee?.firstName ?? ''}  ${oldRole} → ${newRole}`,
    );

    await this.auditService.log({
      userId: actorUserId,
      action: 'user.role_change',
      targetTable: 'users',
      targetId: targetUserId,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
    });

    return { id: updated.id, role: updated.role };
  }

  /**
   * 最後の admin 判定ヘルパー（employees.service の softDelete / 退職処理から再利用）
   *
   * @returns 対象ユーザーが現時点の唯一の admin なら true
   */
  async isLastAdmin(targetUserId: string): Promise<boolean> {
    const target = await this.db.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, employee: { select: { deletedAt: true } } },
    });
    if (!target || target.role !== 'admin' || target.employee?.deletedAt) {
      return false;
    }
    const activeAdminCount = await this.db.user.count({
      where: {
        role: 'admin',
        employee: { deletedAt: null },
      },
    });
    return activeAdminCount <= 1;
  }
}
