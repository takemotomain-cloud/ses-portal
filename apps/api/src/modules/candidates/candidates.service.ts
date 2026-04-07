/**
 * Candidates Service
 *
 * 採用候補者のCRUDビジネスロジック。
 * 候補者の作成・一覧取得を提供。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 候補者を作成
   */
  async create(data: {
    lastName: string;
    firstName: string;
    lastNameKana?: string;
    firstNameKana?: string;
    phone?: string;
    gender?: string;
    residence?: string;
    birthDate?: string;
    education?: string;
    applicationDate: string;
    source: string;
    jobPosting?: string;
    interviewDate?: string;
    interviewTime?: string;
    interviewer?: string;
    confirmStatus?: string;
    desiredLocation?: string;
    desiredMonth?: string;
    interviewPreference?: string;
    recommendation?: string;
    notes?: string;
  }) {
    return this.db.candidate.create({
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        lastNameKana: data.lastNameKana || null,
        firstNameKana: data.firstNameKana || null,
        phone: data.phone || null,
        gender: data.gender || null,
        residence: data.residence || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        education: data.education || null,
        applicationDate: new Date(data.applicationDate),
        source: data.source,
        jobPosting: data.jobPosting || null,
        interviewDate: data.interviewDate ? new Date(data.interviewDate) : null,
        interviewTime: data.interviewTime || null,
        interviewer: data.interviewer || null,
        confirmStatus: data.confirmStatus || null,
        desiredLocation: data.desiredLocation || null,
        desiredMonth: data.desiredMonth || null,
        interviewPreference: data.interviewPreference || null,
        recommendation: data.recommendation || null,
        notes: data.notes || null,
      },
    });
  }

  /**
   * 候補者一覧を取得
   */
  async findAll() {
    return this.db.candidate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 採用経路別分析データ
   * Candidateのsource/statusを集計して返す
   */
  async getAnalytics(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear + 1, 0, 1);

    const candidates = await this.db.candidate.findMany({
      where: {
        applicationDate: { gte: startDate, lt: endDate },
      },
    });

    // 経路別に集計
    const sourceMap = new Map<string, {
      name: string;
      apply: number;
      valid: number;
      first: number;
      final: number;
      offer: number;
      accept: number;
    }>();

    for (const c of candidates) {
      const src = c.source || '不明';
      if (!sourceMap.has(src)) {
        sourceMap.set(src, { name: src, apply: 0, valid: 0, first: 0, final: 0, offer: 0, accept: 0 });
      }
      const s = sourceMap.get(src)!;
      s.apply++;
      // ステータスが進んでいれば前段階もカウント
      const statusOrder = ['new', 'screening', 'first_interview', 'final_interview', 'offer', 'accepted'];
      const idx = statusOrder.indexOf(c.status);
      if (idx >= 1) s.valid++;
      if (idx >= 2) s.first++;
      if (idx >= 3) s.final++;
      if (idx >= 4) s.offer++;
      if (idx >= 5) s.accept++;
    }

    return Array.from(sourceMap.values());
  }

  // ---- 採用経路マスタ ----
  async getSources() {
    return this.db.recruitSource.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createSource(data: { name: string; category: string; fee?: string; memo?: string }) {
    const maxOrder = await this.db.recruitSource.aggregate({ _max: { sortOrder: true } });
    return this.db.recruitSource.create({
      data: { ...data, sortOrder: (maxOrder._max.sortOrder || 0) + 1 },
    });
  }

  async updateSource(id: string, data: { name?: string; category?: string; fee?: string; memo?: string }) {
    return this.db.recruitSource.update({ where: { id }, data });
  }

  async deleteSource(id: string) {
    return this.db.recruitSource.update({ where: { id }, data: { isActive: false } });
  }

  // ---- 採用予算 ----
  async getBudgets(fiscalYear: number) {
    return this.db.recruitBudget.findMany({
      where: { fiscalYear },
      orderBy: [{ category: 'asc' }, { month: 'asc' }],
    });
  }

  async upsertBudget(data: { fiscalYear: number; category: string; month: number; budget?: number; actual?: number }) {
    return this.db.recruitBudget.upsert({
      where: {
        fiscalYear_category_month: {
          fiscalYear: data.fiscalYear,
          category: data.category,
          month: data.month,
        },
      },
      create: {
        fiscalYear: data.fiscalYear,
        category: data.category,
        month: data.month,
        budget: data.budget ?? 0,
        actual: data.actual ?? 0,
      },
      update: {
        ...(data.budget !== undefined ? { budget: data.budget } : {}),
        ...(data.actual !== undefined ? { actual: data.actual } : {}),
      },
    });
  }
}
