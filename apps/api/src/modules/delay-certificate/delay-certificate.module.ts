/**
 * Delay Certificate Module — 遅延証明書モジュール
 */

import { Module } from '@nestjs/common';
import { DelayCertificateController } from './delay-certificate.controller';
import { DelayCertificateService } from './delay-certificate.service';

@Module({
  controllers: [DelayCertificateController],
  providers: [DelayCertificateService],
  exports: [DelayCertificateService],
})
export class DelayCertificateModule {}
