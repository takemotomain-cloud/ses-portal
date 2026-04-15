/**
 * Yearend Service — 年末調整
 *
 * 社員がウィザード5ステップのデータを提出。
 * 管理側で承認・差し戻し。差し戻し後は再提出可能。
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class YearendService {
  private readonly logger = new Logger(YearendService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /** 自分の年末調整状況を取得 */
  async getMyStatus(employeeId: string, fiscalYear: number) {
    return this.db.yearendAdjustment.findUnique({
      where: { employeeId_fiscalYear: { employeeId, fiscalYear } },
    });
  }

  /** 年末調整を提出（新規・再提出） */
  async submit(employeeId: string, fiscalYear: number, formData: any) {
    const existing = await this.db.yearendAdjustment.findUnique({
      where: { employeeId_fiscalYear: { employeeId, fiscalYear } },
    });

    if (existing?.status === 'submitted') {
      throw new BadRequestException('既に提出済みです');
    }
    if (existing?.status === 'approved') {
      throw new BadRequestException('既に承認済みです');
    }
    if (existing?.status === 'closed') {
      throw new BadRequestException('受付期間が終了しています');
    }

    const result = await this.db.yearendAdjustment.upsert({
      where: { employeeId_fiscalYear: { employeeId, fiscalYear } },
      create: {
        employeeId, fiscalYear, formData, status: 'submitted', submittedAt: new Date(),
      },
      update: {
        formData,
        status: 'submitted',
        submittedAt: new Date(),
        rejectReason: null,
        approvedBy: null,
        approvedAt: null,
      },
    });

    this.logger.log(`Yearend adjustment submitted: employee ${employeeId}, year ${fiscalYear}`);
    this.notifications.notifyAdmins('年末調整', 'が年末調整を提出しました。', employeeId).catch(() => {});
    return result;
  }

  /** 承認（管理者用） */
  async approve(id: string, approverId: string) {
    const record = await this.db.yearendAdjustment.findFirst({
      where: { id, status: 'submitted' },
    });
    if (!record) throw new NotFoundException('提出済みの年末調整が見つかりません');

    await this.db.yearendAdjustment.update({
      where: { id },
      data: { status: 'approved', approvedBy: approverId, approvedAt: new Date() },
    });

    this.notifications.create({ employeeId: record.employeeId, title: '年末調整', body: '年末調整が承認されました。' }).catch(() => {});
    return { id };
  }

  /** 差し戻し（管理者用） */
  async reject(id: string, approverId: string, reason: string) {
    const record = await this.db.yearendAdjustment.findFirst({
      where: { id, status: 'submitted' },
    });
    if (!record) throw new NotFoundException('提出済みの年末調整が見つかりません');

    await this.db.yearendAdjustment.update({
      where: { id },
      data: { status: 'rejected', approvedBy: approverId, approvedAt: new Date(), rejectReason: reason },
    });

    this.notifications.create({ employeeId: record.employeeId, title: '年末調整', body: `年末調整が差し戻されました。理由: ${reason}` }).catch(() => {});
    return { id };
  }

  /** 承認待ち一覧（管理者用） */
  async getPendingList(fiscalYear: number) {
    return this.db.yearendAdjustment.findMany({
      where: { fiscalYear, status: 'submitted' },
      include: { employee: { select: { employeeCode: true, lastName: true, firstName: true } } },
      orderBy: { submittedAt: 'asc' },
    });
  }

  /** 全社員の提出状況（管理者用） */
  async getAllStatus(fiscalYear: number) {
    return this.db.yearendAdjustment.findMany({
      where: { fiscalYear },
      include: { employee: { select: { employeeCode: true, lastName: true, firstName: true } } },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }
}
