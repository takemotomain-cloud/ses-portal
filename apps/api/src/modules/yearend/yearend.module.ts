import { Module } from '@nestjs/common';
import { YearendController } from './yearend.controller';
import { YearendService } from './yearend.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [YearendController],
  providers: [YearendService],
  exports: [YearendService],
})
export class YearendModule {}
