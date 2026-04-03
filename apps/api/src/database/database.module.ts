/**
 * Database Module
 *
 * DatabaseService(Prisma)を全モジュールで使えるようにエクスポート。
 * Global: trueにすることで各モジュールでimport不要。
 */

import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
