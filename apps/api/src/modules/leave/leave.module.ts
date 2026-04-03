/**
 * Leave Module — 有給休暇管理
 *
 * 社員側: 申請・残日数確認
 * 管理側: 承認/却下 → 残日数自動減算（FIFO）
 */

import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
