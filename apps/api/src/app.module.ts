/**
 * SES Portal API — ルートモジュール
 *
 * 全モジュールをここで統合する。
 * ConfigModule: 環境変数の一元管理（isGlobal: trueで全モジュールから参照可能）
 * DatabaseModule: Prismaクライアントの接続管理
 * AuthModule: 認証・認可
 * EmployeesModule: 社員CRUD（Phase 1の最初の機能モジュール）
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './common/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { WorkRulesModule } from './modules/work-rules/work-rules.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { YearendModule } from './modules/yearend/yearend.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ClientsModule } from './modules/clients/clients.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    EmployeesModule,
    AttendanceModule,
    LeaveModule,
    AssignmentsModule,
    WorkRulesModule,
    ProfileModule,
    ExpenseModule,
    PayrollModule,
    NotificationsModule,
    CertificatesModule,
    YearendModule,
    DashboardModule,
    ClientsModule,
    MeetingsModule,
    CandidatesModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
