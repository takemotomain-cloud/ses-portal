/**
 * AgentsModule
 *
 * ダッシュボード AI Agent Control Room のバックエンド最小モジュール。
 * 現状は AgentsService のみ。後続で AgentsController（REST）を追加予定。
 */

import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentToolsService } from './agent-tools.service';
import { ExpenseModule } from '../expense/expense.module';
import { LeaveModule } from '../leave/leave.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [ExpenseModule, LeaveModule, AttendanceModule, NotificationsModule, InvoicesModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentToolsService],
  exports: [AgentsService],
})
export class AgentsModule {}
