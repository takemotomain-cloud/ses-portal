/**
 * Assignments Module
 *
 * 稼働情報の機能モジュール。
 * 社員側: 現在の稼働先詳細 + 稼働ヒストリー閲覧
 * 管理側: 全アサインの管理（Phase 2以降で拡張）
 */

import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
