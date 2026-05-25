/**
 * Leave of Absence Module — 休職届モジュール
 */

import { Module } from '@nestjs/common';
import { LeaveOfAbsenceController } from './leave-of-absence.controller';
import { LeaveOfAbsenceService } from './leave-of-absence.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeaveOfAbsenceController],
  providers: [LeaveOfAbsenceService],
  exports: [LeaveOfAbsenceService],
})
export class LeaveOfAbsenceModule {}
