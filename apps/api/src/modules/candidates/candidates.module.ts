/**
 * Candidates Module
 *
 * 採用候補者の機能モジュール。
 * 候補者のCRUDを提供。
 */

import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
