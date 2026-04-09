/**
 * Mailer Service — メール送信抽象化レイヤ
 *
 * 2026-04 より nodemailer → Resend に統一（決定事項 S2）。
 * 添付ファイル（PDF 等）・リトライ・失敗ログは呼び出し側が管理する設計。
 *
 * 環境変数:
 *   RESEND_API_KEY — Resend の API キー
 *   MAIL_FROM      — 送信元アドレス（例: "株式会社Lervia <sales@lervia.co.jp>"）
 *
 * テスト環境等で RESEND_API_KEY が未設定の場合、実送信はスキップしつつ
 * {status:'sent'} を返すのではなく、{status:'failed', error:'dry-run'} を返す。
 * 呼び出し側は status を見て履歴テーブルに failed を記録する。
 */

import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  status: 'sent' | 'failed';
  error?: string;
  id?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY || '';
    this.from = process.env.MAIL_FROM || '株式会社Lervia <sales@lervia.co.jp>';
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY が未設定のため、メール送信はドライラン動作になります');
    }
  }

  /**
   * メール送信。Resend SDK を呼び出し、status を返す。
   * 失敗時は例外を投げずに {status:'failed', error} を返す方針（呼び出し側が履歴記録しやすい）。
   */
  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    if (!this.resend) {
      this.logger.warn(`[dry-run] to=${options.to} subject=${options.subject}`);
      return { status: 'failed', error: 'RESEND_API_KEY not set (dry-run)' };
    }

    try {
      const res = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      if (res.error) {
        this.logger.error(`Resend error: ${JSON.stringify(res.error)}`);
        return { status: 'failed', error: res.error.message ?? 'unknown' };
      }
      return { status: 'sent', id: res.data?.id };
    } catch (err: any) {
      this.logger.error(`MailerService 送信失敗: ${err?.message ?? err}`);
      return { status: 'failed', error: err?.message ?? String(err) };
    }
  }
}
