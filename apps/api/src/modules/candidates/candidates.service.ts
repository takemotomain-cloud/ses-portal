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
}
