/**
 * Yearend Service — 年末調整
 *
 * 社員がウィザード5ステップのデータを提出。
 * 管理側で受付期間を制御（open/closed）。
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class YearendService {
  private readonly logger = new Logger(YearendService.name);

  constructor(private readonly db: DatabaseService) {}

  /** 自分の年末調整状況を取得 */
  async getMyStatus(employeeId: string, fiscalYear: number) {
    return this.db.yearendAdjustment.findUnique({
      where: { employeeId_fiscalYear: { employeeId, fiscalYear } },
    });
  }

  /** 年末調整を提出 */
  async submit(employeeId: string, fiscalYear: number, formData: any) {
    const existing = await this.db.yearendAdjustment.findUnique({
      where: { employeeId_fiscalYear: { employeeId, fiscalYear } },
    });

    if (existing?.status === 'submitted') {
      throw new BadRequestException('既に提出済みです');
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
        formData, status: 'submitted', submittedAt: new Date(),
      },
    });

    this.logger.log(`Yearend adjustment submitted: employee ${employeeId}, year ${fiscalYear}`);
    return result;
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
