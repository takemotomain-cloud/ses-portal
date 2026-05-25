import { Module } from '@nestjs/common';
import { SkillsheetsController } from './skillsheets.controller';
import { SkillsheetsService } from './skillsheets.service';

@Module({
  controllers: [SkillsheetsController],
  providers: [SkillsheetsService],
})
export class SkillsheetsModule {}
