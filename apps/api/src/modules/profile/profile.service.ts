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
import { BCRYPT_ROUNDS } from '@ses-portal/shared';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly db: DatabaseService) {}

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

    return this.db.changeRequest.create({
      data: {
        employeeId,
        changeType: 'address',
        oldValue: current as any,
        newValue: data as any,
        status: 'pending',
      },
    });
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

    return this.db.changeRequest.create({
      data: {
        employeeId,
        changeType: 'bank',
        oldValue: current as any,
        newValue: data as any,
        status: 'pending',
      },
    });
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
  async approveChangeRequest(requestId: string, approverId: string) {
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
  }

  /**
   * 変更申請を却下（管理者用）
   */
  async rejectChangeRequest(requestId: string, approverId: string) {
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
