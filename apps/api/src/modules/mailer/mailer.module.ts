/**
 * MailerModule — Resend ベースのメール送信を全モジュールで使えるように Global 公開
 */

import { Global, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
