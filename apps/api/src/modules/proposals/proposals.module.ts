import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { SkillsheetPdfService } from './skillsheet-pdf.service';

@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService, SkillsheetPdfService],
})
export class ProposalsModule {}
