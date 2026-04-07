import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AutoNotificationController } from './auto-notification.controller';
import { AutoNotificationService } from './auto-notification.service';

@Module({
  controllers: [NotificationsController, AutoNotificationController],
  providers: [NotificationsService, AutoNotificationService],
  exports: [NotificationsService, AutoNotificationService],
})
export class NotificationsModule {}
