/**
 * AuditLogsModule — 監査ログ（T2）
 *
 * AuditService を Global 提供。各モジュールから `this.auditService.log(...)` で記録できる。
 * 管理画面「操作ログ」タブ向けに AuditLogsController も提供（GET /audit-logs）。
 */

import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogsController } from './audit-logs.controller';

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditLogsModule {}
