import { Module } from '@nestjs/common';
import { GeneralExpenseController } from './general-expense.controller';
import { GeneralExpenseService } from './general-expense.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GeneralExpenseController],
  providers: [GeneralExpenseService],
  exports: [GeneralExpenseService],
})
export class GeneralExpenseModule {}
