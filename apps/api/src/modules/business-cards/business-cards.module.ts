/**
 * Business Cards Module
 *
 * 名刺スキャン（Claude Vision API）と名刺データ管理。
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessCardsController } from './business-cards.controller';
import { BusinessCardsService } from './business-cards.service';

@Module({
  imports: [ConfigModule],
  controllers: [BusinessCardsController],
  providers: [BusinessCardsService],
  exports: [BusinessCardsService],
})
export class BusinessCardsModule {}
