/**
 * Attendance Service
 *
 * 勤怠のビジネスロジック。
 *
 * 処理フロー:
 * 1. 出勤打刻: clock_inを記録、ステータスをnormalに
 * 2. 退勤打刻: clock_outを記録、work_minutes/overtime_minutesを自動計算
 * 3. 休憩変更: break_minutesを更新、稼働/残業を再計算
 * 4. 打刻漏れ検知: clock_outがNULLのまま翌日になったレコードを検出
 *
 * セキュリティ: 社員は自分の勤怠のみ操作可能。管理者は全社員を閲覧可能。
 * パフォーマンス: 月次データは最大31行。ページネーション不要。
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { STANDARD_WORK_MINUTES } from '@ses-portal/shared';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 出勤打刻
   *
   * 1日に2回出勤打刻はできない（UNIQUE制約で防止）。
   * 同日にレコードが既に存在する場合はエラー。
   */
  async clockIn(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 既に打刻済みか確認
    const existing = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: today,
        },
      },
    });

    if (existing?.clockIn) {
      throw new BadRequestException('本日は既に出勤打刻済みです');
    }

    const now = new Date();

    if (existing) {
      // 欠勤レコード等が先に作られている場合はUPDATE
      return this.db.attendance.update({
        where: { id: existing.id },
        data: {
          clockIn: now,
          status: 'normal',
          isMissedClock: false,
        },
      });
    }

    return this.db.attendance.create({
      data: {
        employeeId,
        workDate: today,
        clockIn: now,
        status: 'normal',
      },
    });
  }

  /**
   * 退勤打刻
   *
   * 出勤打刻がない場合はエラー。
   * 退勤時に稼働時間と残業時間を自動計算する。
   */
  async clockOut(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: today,
        },
      },
    });

    if (!record || !record.clockIn) {
      throw new BadRequestException('出勤打刻がありません');
    }

    if (record.clockOut) {
      throw new BadRequestException('本日は既に退勤打刻済みです');
    }

    const now = new Date();
    const clockInTime = new Date(record.clockIn);
    const totalMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);
    const workMinutes = totalMinutes - record.breakMinutes;
    const overtimeMinutes = Math.max(0, workMinutes - STANDARD_WORK_MINUTES);

    return this.db.attendance.update({
      where: { id: record.id },
      data: {
        clockOut: now,
        workMinutes,
        overtimeMinutes,
      },
    });
  }

  /**
   * 月次勤怠データ取得
   */
  async getMonthly(employeeId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // 月末

    return this.db.attendance.findMany({
      where: {
        employeeId,
        workDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { workDate: 'asc' },
    });
  }

  /**
   * 休憩時間変更 → 稼働・残業を再計算
   */
  async updateBreak(attendanceId: string, employeeId: string, breakMinutes: number) {
    if (breakMinutes < 0 || breakMinutes > 480) {
      throw new BadRequestException('休憩時間は0〜480分で指定してください');
    }

    const record = await this.db.attendance.findFirst({
      where: { id: attendanceId, employeeId },
    });

    if (!record) {
      throw new NotFoundException('勤怠レコードが見つかりません');
    }

    // 稼働・残業の再計算
    let workMinutes = record.workMinutes;
    let overtimeMinutes = record.overtimeMinutes;

    if (record.clockIn && record.clockOut) {
      const totalMinutes = Math.floor(
        (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 60000,
      );
      workMinutes = totalMinutes - breakMinutes;
      overtimeMinutes = Math.max(0, workMinutes - STANDARD_WORK_MINUTES);
    }

    return this.db.attendance.update({
      where: { id: attendanceId },
      data: {
        breakMinutes,
        workMinutes,
        overtimeMinutes,
      },
    });
  }

  /**
   * 打刻漏れ検知
   *
   * clock_inがあってclock_outがNULLのまま前日以前のレコードを検出。
   * 日次バッチまたはログイン時に呼び出す。
   */
  async detectMissedClocks(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.db.attendance.findMany({
      where: {
        employeeId,
        clockIn: { not: null },
        clockOut: null,
        workDate: { lt: today },
        isMissedClock: false,
      },
    });
  }
}
