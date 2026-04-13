/**
 * Settings Module
 *
 * 部署・役職管理の機能モジュール。
 * 管理者のみ利用可能。
 */

import { Module } from '@nestjs/common';
import { SettingsController, GoogleDriveCallbackController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController, GoogleDriveCallbackController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
