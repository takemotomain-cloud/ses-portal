/**
 * Attendance Module
 *
 * 勤怠管理の機能モジュール。
 * 社員側: 打刻（出勤/退勤）、月次勤怠閲覧、休憩時間変更
 * 管理側: 全社員の勤怠閲覧、打刻漏れ検知
 * 突合:   現場勤怠表の取込み・自動突合・確定
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [ConfigModule],
  controllers: [ReconciliationController, AttendanceController],
  providers: [AttendanceService, ReconciliationService],
  exports: [AttendanceService, ReconciliationService],
})
export class AttendanceModule {}
