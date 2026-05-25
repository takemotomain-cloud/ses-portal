import { Module } from '@nestjs/common';
import { FreeeController } from './freee.controller';
import { FreeeService } from './freee.service';

@Module({
  controllers: [FreeeController],
  providers: [FreeeService],
})
export class FreeeModule {}
