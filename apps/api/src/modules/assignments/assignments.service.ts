/**
 * Assignments Service
 *
 * 稼働情報のビジネスロジック。
 *
 * 社員向けAPI:
 * - 現在の稼働先（status=active のレコード）
 * - 稼働ヒストリー（全レコード、新しい順）
 *
 * セキュリティ: 社員は自分のアサインのみ閲覧可能。
 * 単価・還元率は社員に公開する設計（SES業界の慣行）。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PAGINATION } from '@ses-portal/shared';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 新規アサイン作成
   */
  async create(data: {
    employeeId: string;
    clientId: string;
    projectName: string;
    contractPrice: number;
    settlementLower: number;
    settlementUpper: number;
    workLocation?: string;
    area?: string;
    defaultStartTime?: string;
    attendanceFormat?: string;
    startDate: string;
    endDate?: string;
  }) {
    return this.db.assignment.create({
      data: {
        employeeId: data.employeeId,
        clientId: data.clientId,
        projectName: data.projectName,
        contractPrice: data.contractPrice,
        settlementLower: data.settlementLower,
        settlementUpper: data.settlementUpper,
        workLocation: data.workLocation || null,
        area: data.area || null,
        defaultStartTime: data.defaultStartTime || null,
        attendanceFormat: data.attendanceFormat || 'none',
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: 'active',
      },
      include: {
        employee: {
          select: { id: true, lastName: true, firstName: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * アサイン一覧を取得（管理側用）
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const page = params.page || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      params.limit || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (params.status) {
      where.status = params.status;
    }

    const [data, total] = await Promise.all([
      this.db.assignment.findMany({
        where,
        include: {
          employee: {
            select: { id: true, lastName: true, firstName: true, employeeCode: true },
          },
          client: {
            select: { id: true, name: true },
          },
        },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
      this.db.assignment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 稼働終了
   * mode: 'scheduled' = 契約期間通り終了（endDateそのまま、ステータスending_scheduled）
   *        'immediate' = 途中終了（endDateを指定日に上書き、ステータスended）
   */
  async endAssignment(id: string, data?: { mode?: string; endDate?: string; endReason?: string }) {
    const mode = data?.mode || 'immediate';

    if (mode === 'scheduled') {
      // 契約期間通り終了 → 終了予定ステータスに変更（endDateはそのまま）
      return this.db.assignment.update({
        where: { id },
        data: {
          status: 'ending_scheduled',
          endReason: data?.endReason || 'term_end',
        },
      });
    }

    // 途中終了 → 即終了
    return this.db.assignment.update({
      where: { id },
      data: {
        status: 'ended',
        endDate: data?.endDate ? new Date(data.endDate) : new Date(),
        endReason: data?.endReason || 'early_termination',
      },
    });
  }

  /**
   * 契約延長（endDateを更新）
   */
  async extendAssignment(id: string, newEndDate: string) {
    return this.db.assignment.update({
      where: { id },
      data: {
        endDate: new Date(newEndDate),
        // ending_scheduledだった場合はactiveに戻す
        status: 'active',
      },
    });
  }

  /**
   * 現在の稼働先を取得
   *
   * status=active のアサインを返す。
   * クライアント情報（会社名・連絡先）もJOINで取得。
   * アサインがない場合はnullを返す（エラーにはしない）。
   */
  async getCurrentAssignment(employeeId: string) {
    return this.db.assignment.findFirst({
      where: {
        employeeId,
        status: 'active',
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            industry: true,
            contactPerson: true,
          },
        },
      },
    });
  }

  /**
   * 稼働ヒストリーを取得
   *
   * 全アサイン（終了済み含む）を開始日の新しい順で返す。
   * パフォーマンス: 1社員のアサイン数は通常10件以下なのでページネーション不要。
   */
  async getHistory(employeeId: string) {
    return this.db.assignment.findMany({
      where: {
        employeeId,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
