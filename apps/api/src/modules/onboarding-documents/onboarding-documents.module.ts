import { Module } from '@nestjs/common';
import { OnboardingDocumentsController } from './onboarding-documents.controller';
import { OnboardingDocumentsService } from './onboarding-documents.service';

@Module({
  controllers: [OnboardingDocumentsController],
  providers: [OnboardingDocumentsService],
  exports: [OnboardingDocumentsService],
})
export class OnboardingDocumentsModule {}
