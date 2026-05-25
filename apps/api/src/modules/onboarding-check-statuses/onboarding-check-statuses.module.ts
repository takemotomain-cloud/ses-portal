import { Module } from '@nestjs/common';
import { OnboardingCheckStatusesController } from './onboarding-check-statuses.controller';
import { OnboardingCheckStatusesService } from './onboarding-check-statuses.service';

@Module({
  controllers: [OnboardingCheckStatusesController],
  providers: [OnboardingCheckStatusesService],
  exports: [OnboardingCheckStatusesService],
})
export class OnboardingCheckStatusesModule {}
