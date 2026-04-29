/**
 * Delay Certificate Module — 遅延証明書モジュール
 */

import { Module } from '@nestjs/common';
import { DelayCertificateController } from './delay-certificate.controller';
import { DelayCertificateService } from './delay-certificate.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DelayCertificateController],
  providers: [DelayCertificateService],
  exports: [DelayCertificateService],
})
export class DelayCertificateModule {}
