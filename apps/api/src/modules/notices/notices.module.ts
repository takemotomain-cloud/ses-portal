import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';
import { NoticePdfService } from './notice-pdf.service';

@Module({
  controllers: [NoticesController],
  providers: [NoticesService, NoticePdfService],
  exports: [NoticesService],
})
export class NoticesModule {}
