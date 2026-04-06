/**
 * Clients Module
 *
 * クライアント（取引先）管理の機能モジュール。
 * CRUD + 一覧/検索/詳細を提供。
 *
 * 権限:
 * - admin: 全操作
 * - sales: 閲覧・作成
 */

import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { GBizInfoService } from './gbizinfo.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, GBizInfoService],
  exports: [ClientsService],
})
export class ClientsModule {}
