/**
 * Meetings Service
 *
 * 面談記録のCRUDビジネスロジック。
 * 社員ごとの面談記録の作成・一覧取得を提供。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 面談記録を作成
   *
   * @param employeeId 社員UUID
   * @param data 面談データ
   */
  async create(
    employeeId: string,
    data: {
      date: string;
      interviewer: string;
      content: string;
      videoUrl?: string;
    },
  ) {
    return this.db.meeting.create({
      data: {
        employeeId,
        date: new Date(data.date),
        interviewer: data.interviewer,
        content: data.content,
        videoUrl: data.videoUrl || null,
      },
    });
  }

  /**
   * 社員の面談記録一覧を取得
   *
   * @param employeeId 社員UUID
   */
  async findByEmployee(employeeId: string) {
    return this.db.meeting.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
    });
  }
}
