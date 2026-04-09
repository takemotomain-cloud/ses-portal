/**
 * Users Module — ロール変更 API とユーザー関連ユーティリティ（E）
 *
 * - AuditLogsModule は Global なので import 不要。
 * - DatabaseModule も Global 提供済み。
 * - UsersService を exports して、他モジュール（employees など）から
 *   `isLastAdmin()` ヘルパーを再利用できるようにする。
 */

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
