/**
 * Profile Service
 *
 * 社員の個人情報閲覧と変更申請を管理。
 * パスワード変更もここで処理。
 *
 * セキュリティ:
 * - 個人情報変更は即時反映せず、change_requestsに記録→管理者承認後に反映
 * - パスワード変更は現在のパスワード確認必須
 * - マイナンバーはこのAPIでは返さない（専用APIで別途管理）
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit-logs/audit.service';
import { BCRYPT_ROUNDS } from '@ses-portal/shared';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 個人情報を取得（社員自身が閲覧する用）
   *
   * マイナンバー・パスワードハッシュは除外。
   * 口座情報は社員本人にのみ返す。
   */
  async getProfile(employeeId: string) {
    const emp = await this.db.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
        emergencyContacts: { orderBy: { sortOrder: 'asc' } },
        dependents: { where: { isActive: true, deletedAt: null } },
      },
    });

    if (!emp) return null;

    // マイナンバーは除外
    const { myNumber, ...profile } = emp;
    return profile;
  }

  /**
   * 氏名変更申請（Q1: 承認必須）
   *
   * 婚姻・養子縁組などで氏名が変わる場合に申請。承認後に employees テーブルに反映。
   */
  async requestNameChange(employeeId: string, data: {
    lastName: string;
    firstName: string;
    lastNameKana?: string;
    firstNameKana?: string;
  }) {
    if (!data.lastName?.trim() || !data.firstName?.trim()) {
      throw new BadRequestException('姓と名は必須です');
    }

    const current = await this.db.employee.findUnique({
      where: { id: employeeId },
      select: {
        lastName: true,
        firstName: true,
        lastNameKana: true,
        firstNameKana: true,
      },
    });

    const result = await this.db.changeRequest.create({
      data: {
        employeeId,
        changeType: 'name',
        oldValue: current as any,
        newValue: data as any,
        status: 'pending',
      },
    });

    this.notifications.notifyAdmins('個人情報変更', '氏名変更申請が提出されました。').catch(() => {});
    return result;
  }

  /**
   * 電話番号の即時更新（Q1: 即時反映）
   *
   * 電話番号は承認フローを経由せず、社員本人の操作で即時更新する。
   * 監査ログ目的で変更履歴を change_requests に approved ステータスで記録する。
   */
  async updatePhone(employeeId: string, phone: string) {
    const trimmed = (phone || '').trim();
    if (!trimmed) {
      throw new BadRequestException('電話番号を入力してください');
    }

    const current = await this.db.employee.findUnique({
      where: { id: employeeId },
      select: { phone: true },
    });

    await this.db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: { phone: trimmed },
      });

      // 変更履歴として change_requests に approved で記録（監査ログ用途）
      await tx.changeRequest.create({
        data: {
          employeeId,
          changeType: 'phone',
          oldValue: current as any,
          newValue: { phone: trimmed } as any,
          status: 'approved',
          approverId: employeeId, // 自己承認（即時反映）
          approvedAt: new Date(),
        },
      });
    });

    this.logger.log(`電話番号を即時更新: employee=${employeeId}`);
    return { phone: trimmed, immediate: true };
  }

  /**
   * 住所変更申請
   */
  async requestAddressChange(employeeId: string, data: {
    postalCode: string;
    address: string;
    moveDate?: string;
  }) {
    const current = await this.db.employee.findUnique({
      where: { id: employeeId },
      select: { postalCode: true, address: true },
    });

    const result = await this.db.changeRequest.create({
      data: {
        employeeId,
        changeType: 'address',
        oldValue: current as any,
        newValue: data as any,
        status: 'pending',
      },
    });

    this.notifications.notifyAdmins('個人情報変更', '住所変更申請が提出されました。').catch(() => {});
    return result;
  }

  /**
   * 口座変更申請
   */
  async requestBankChange(employeeId: string, data: {
    bankName: string;
    bankBranch: string;
    bankAccountType: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
  }) {
    const current = await this.db.employee.findUnique({
      where: { id: employeeId },
      select: {
        bankName: true,
        bankBranch: true,
        bankAccountType: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
      },
    });

    const result = await this.db.changeRequest.create({
      data: {
        employeeId,
        changeType: 'bank',
        oldValue: current as any,
        newValue: data as any,
        status: 'pending',
      },
    });

    this.notifications.notifyAdmins('個人情報変更', '口座変更申請が提出されました。').catch(() => {});
    return result;
  }

  /**
   * 承認待ちの変更申請一覧（管理者用）
   */
  async getPendingChangeRequests() {
    return this.db.changeRequest.findMany({
      where: { status: 'pending' },
      include: {
        employee: {
          select: {
            lastName: true,
            firstName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 変更申請を承認（管理者用）
   * 承認時にemployeesテーブルに変更を反映する
   */
  async approveChangeRequest(requestId: string, approverId: string, actorUserId?: string) {
    const request = await this.db.changeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('申請が見つかりません');
    if (request.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');

    await this.db.$transaction(async (tx) => {
      // 1. 申請を承認
      await tx.changeRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approverId,
          approvedAt: new Date(),
        },
      });

      // 2. 変更内容をemployeesに反映
      const newValue = request.newValue as Record<string, any>;
      if (newValue && Object.keys(newValue).length > 0) {
        await tx.employee.update({
          where: { id: request.employeeId },
          data: newValue,
        });
      }
    });

    this.logger.log(`Change request ${requestId} approved by ${approverId}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'profile.change_approve',
      targetTable: 'change_requests',
      targetId: requestId,
      oldValue: request.oldValue as any,
      newValue: { ...(request.newValue as any), changeType: request.changeType, employeeId: request.employeeId },
    });

    this.notifications.create({ employeeId: request.employeeId, title: '個人情報変更', body: '個人情報変更申請が承認されました。' }).catch(() => {});
  }

  /**
   * 変更申請を却下（管理者用）
   */
  async rejectChangeRequest(requestId: string, approverId: string, actorUserId?: string) {
    const request = await this.db.changeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('申請が見つかりません');
    if (request.status !== 'pending') throw new BadRequestException('この申請は既に処理済みです');

    await this.db.changeRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        approverId,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Change request ${requestId} rejected by ${approverId}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'profile.change_reject',
      targetTable: 'change_requests',
      targetId: requestId,
      newValue: { changeType: request.changeType, employeeId: request.employeeId },
    });

    this.notifications.create({ employeeId: request.employeeId, title: '個人情報変更', body: '個人情報変更申請が却下されました。' }).catch(() => {});
  }

  /**
   * パスワード変更
   *
   * セキュリティ:
   * - 現在のパスワード確認必須
   * - 新パスワードは8文字以上
   * - bcrypt(cost 12)でハッシュ化
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('パスワードは8文字以上で入力してください');
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('ユーザーが見つかりません');
    }

    // 現在のパスワードを検証
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('現在のパスワードが正しくありません');
    }

    // 新しいパスワードをハッシュ化して保存
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.db.user.update({
      where: { id: userId },
      data: {
        passwordHash: hash,
        passwordChangedAt: new Date(),
      },
    });

    this.logger.log(`Password changed for user ${userId}`);
  }
}
