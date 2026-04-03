/**
 * Attendance Module
 *
 * 勤怠管理の機能モジュール。
 * 社員側: 打刻（出勤/退勤）、月次勤怠閲覧、休憩時間変更
 * 管理側: 全社員の勤怠閲覧、打刻漏れ検知
 */

import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
