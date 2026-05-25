/**
 * Work Rules Module — 就業規則管理
 *
 * 社員側: 現行版の閲覧
 * 管理側: 編集・公開・バージョン管理（Phase 2以降で拡張）
 */

import { Module } from '@nestjs/common';
import { WorkRulesController } from './work-rules.controller';
import { WorkRulesService } from './work-rules.service';

@Module({
  controllers: [WorkRulesController],
  providers: [WorkRulesService],
  exports: [WorkRulesService],
})
export class WorkRulesModule {}
