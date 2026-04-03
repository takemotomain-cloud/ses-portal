import { Module } from '@nestjs/common';
import { YearendController } from './yearend.controller';
import { YearendService } from './yearend.service';

@Module({
  controllers: [YearendController],
  providers: [YearendService],
  exports: [YearendService],
})
export class YearendModule {}
