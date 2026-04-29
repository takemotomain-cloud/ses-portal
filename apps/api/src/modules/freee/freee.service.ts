import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FreeeService {
  constructor(private readonly db: DatabaseService) {}

  private ensureSyncEnabled() {
    if (process.env.FREEE_SYNC_MODE === 'live') {
      return;
    }

    throw new ServiceUnavailableException(
      'freee連携の実送信はまだ有効化されていません。FREEE_SYNC_MODE=live を設定した環境でのみ実行してください。',
    );
  }

  async getJournals(status?: string) {
    return this.db.freeeJournal.findMany({
      where: status ? { status } : undefined,
      orderBy: { date: 'desc' },
    });
  }

  async getSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, sent, errors] = await Promise.all([
      this.db.freeeJournal.count({ where: { date: { gte: startOfMonth } } }),
      this.db.freeeJournal.count({ where: { date: { gte: startOfMonth }, status: 'sent' } }),
      this.db.freeeJournal.count({ where: { date: { gte: startOfMonth }, status: 'error' } }),
    ]);

    return { total, sent, errors, unsent: total - sent - errors };
  }

  async createJournal(data: {
    date: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
  }) {
    return this.db.freeeJournal.create({
      data: {
        date: new Date(data.date),
        description: data.description,
        debitAccount: data.debitAccount,
        creditAccount: data.creditAccount,
        amount: data.amount,
      },
    });
  }

  async markAsSent(id: string) {
    return this.db.freeeJournal.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  async sendAll() {
    this.ensureSyncEnabled();

    const unsent = await this.db.freeeJournal.findMany({ where: { status: 'unsent' } });
    let success = 0;
    let errors = 0;

    for (const j of unsent) {
      try {
        // 実際の freee API 送信は live モードの実装時にここへ入れる。
        await this.db.freeeJournal.update({
          where: { id: j.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        success++;
      } catch {
        await this.db.freeeJournal.update({
          where: { id: j.id },
          data: { status: 'error', errorMessage: '送信に失敗しました' },
        });
        errors++;
      }
    }

    return { success, errors, total: unsent.length };
  }
}
