import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FreeeService {
  constructor(private readonly db: DatabaseService) {}

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
    const unsent = await this.db.freeeJournal.findMany({ where: { status: 'unsent' } });
    let success = 0;
    let errors = 0;

    for (const j of unsent) {
      try {
        // TODO: 実際のfreee API連携時はここで送信処理
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
