/**
 * Employees Module
 *
 * 社員管理の機能モジュール。Phase 1の最初の機能実装。
 * 社員マスタのCRUD + 一覧/検索/詳細を提供。
 *
 * 権限:
 * - admin: 全操作（作成・編集・削除・全社員閲覧）
 * - sales: 閲覧のみ（自分の担当社員）
 * - employee: 自分の情報のみ閲覧
 */

import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
