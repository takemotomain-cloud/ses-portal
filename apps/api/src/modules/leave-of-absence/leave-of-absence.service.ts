/**
 * Leave of Absence Service — 休職届ビジネスロジック
 *
 * ステータスフロー:
 *   pending → on_leave (承認) → return_pending (復職届) → returned (復職承認)
 *   pending → rejected (却下)
 *
 * 承認時に社員ステータスを自動で 'leave' に更新。
 * 復職承認時に 'active' に戻す。
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

/** 休職種別ごとの最大日数 */
const MAX_DAYS: Record<string, number> = {
  injury: 548,      // 18ヶ月
  childcare: 731,   // 24ヶ月
  nursing: 93,      // 93日
  other: 366,       // 12ヶ月
};

@Injectable()
export class LeaveOfAbsenceService {
  private readonly logger = new Logger(LeaveOfAbsenceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 休職届を提出
   */
  async submit(
    employeeId: string,
    data: {
      absenceType: string;
      startDate: string;
      expectedReturnDate: string;
      reason?: string;
      filePath?: string;
      fileName?: string;
    },
  ) {
    const start = new Date(data.startDate);
    const end = new Date(data.expectedReturnDate);

    if (end <= start) {
      throw new BadRequestException('復職予定日は休職開始日より後にしてください');
    }

    // 期間上限チェック
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = MAX_DAYS[data.absenceType];
    if (maxDays && diffDays > maxDays) {
      throw new BadRequestException(`${data.absenceType}の最大休職期間（${maxDays}日）を超えています`);
    }

    // 重複チェック
    const existing = await this.db.leaveOfAbsence.findFirst({
      where: {
        employeeId,
        status: { in: ['pending', 'on_leave', 'return_pending'] },
      },
    });
    if (existing) {
      throw new BadRequestException('既に未完了の休職届があります');
    }

    const record = await this.db.leaveOfAbsence.create({
      data: {
        employeeId,
        absenceType: data.absenceType,
        startDate: start,
        expectedReturnDate: end,
        reason: data.reason,
        filePath: data.filePath,
        fileName: data.fileName,
        status: 'pending',
      },
    });

    this.logger.log(`休職届を提出: employee=${employeeId}, type=${data.absenceType}`);
    this.notifications.notifyAdmins('休職届', '休職届が提出されました。').catch(() => {});
    return { id: record.id };
  }

  /**
   * 休職届を承認 → 社員ステータスを 'leave' に更新
   */
  async approve(id: string, approverId: string) {
    const record = await this.db.leaveOfAbsence.findFirst({
      where: { id, status: 'pending' },
    });
    if (!record) {
      throw new NotFoundException('承認待ちの休職届が見つかりません');
    }

    await this.db.$transaction(async (tx) => {
      await tx.leaveOfAbsence.update({
        where: { id },
        data: {
          status: 'on_leave',
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });

      await tx.employee.update({
        where: { id: record.employeeId },
        data: { status: 'leave' },
      });
    });

    this.logger.log(`休職届を承認: id=${id}, approver=${approverId}`);
    this.notifications.create({ employeeId: record.employeeId, title: '休職届', body: '休職届が承認されました。' }).catch(() => {});
    return { id };
  }

  /**
   * 休職届を却下
   */
  async reject(id: string, approverId: string, reason?: string) {
    const record = await this.db.leaveOfAbsence.findFirst({
      where: { id, status: 'pending' },
    });
    if (!record) {
      throw new NotFoundException('承認待ちの休職届が見つかりません');
    }

    await this.db.leaveOfAbsence.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectReason: reason || null,
      },
    });

    this.logger.log(`休職届を却下: id=${id}`);
    this.notifications.create({ employeeId: record.employeeId, title: '休職届', body: '休職届が却下されました。' }).catch(() => {});
    return { id };
  }

  /**
   * 復職届を提出
   */
  async submitReturn(id: string, employeeId: string, actualReturnDate: string) {
    const record = await this.db.leaveOfAbsence.findFirst({
      where: { id, employeeId, status: 'on_leave' },
    });
    if (!record) {
      throw new NotFoundException('休職中の記録が見つかりません');
    }

    await this.db.leaveOfAbsence.update({
      where: { id },
      data: {
        status: 'return_pending',
        actualReturnDate: new Date(actualReturnDate),
        returnSubmittedAt: new Date(),
      },
    });

    this.logger.log(`復職届を提出: id=${id}, employee=${employeeId}`);
    this.notifications.notifyAdmins('復職届', '復職届が提出されました。').catch(() => {});
    return { id };
  }

  /**
   * 復職を承認 → 社員ステータスを 'active' に戻す
   */
  async approveReturn(id: string, approverId: string) {
    const record = await this.db.leaveOfAbsence.findFirst({
      where: { id, status: 'return_pending' },
    });
    if (!record) {
      throw new NotFoundException('復職待ちの記録が見つかりません');
    }

    await this.db.$transaction(async (tx) => {
      await tx.leaveOfAbsence.update({
        where: { id },
        data: {
          status: 'returned',
          returnApprovedBy: approverId,
          returnApprovedAt: new Date(),
        },
      });

      await tx.employee.update({
        where: { id: record.employeeId },
        data: { status: 'active' },
      });
    });

    this.logger.log(`復職を承認: id=${id}, approver=${approverId}`);
    this.notifications.create({ employeeId: record.employeeId, title: '休職届', body: '復職が承認されました。' }).catch(() => {});
    return { id };
  }

  /**
   * 承認待ち一覧（pending + return_pending）
   */
  async getPending() {
    return this.db.leaveOfAbsence.findMany({
      where: { status: { in: ['pending', 'return_pending'] } },
      include: {
        employee: {
          select: { lastName: true, firstName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 自分の休職届一覧
   */
  async getMyList(employeeId: string) {
    return this.db.leaveOfAbsence.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
