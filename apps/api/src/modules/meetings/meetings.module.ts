/**
 * Meetings Module
 *
 * 面談記録の機能モジュール。
 * 社員ごとの面談記録のCRUDを提供。
 */

import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
