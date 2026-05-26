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

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PAGINATION } from '@ses-portal/shared';

// デフォルトテナントID（シングルテナント運用時の暫定値、JWT導入後に忠実な値へ置厰）
const SYSTEM_TENANT_ID = process.env.SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

function dateOnlyJst(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000);
}

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
    overtimeRate?: number | null;
    deductionRate?: number | null;
    workLocation?: string;
    area?: string;
    defaultStartTime?: string;
    attendanceFormat?: string;
    clientAttendanceRequired?: boolean;
    projectId?: string;
    startDate: string;
    endDate?: string;
  }, tenantId: string) {
    return this.db.assignment.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        clientId: data.clientId,
        projectId: data.projectId || null,
        projectName: data.projectName,
        contractPrice: data.contractPrice,
        settlementLower: data.settlementLower,
        settlementUpper: data.settlementUpper,
        overtimeRate: data.overtimeRate ?? null,
        deductionRate: data.deductionRate ?? null,
        workLocation: data.workLocation || null,
        area: data.area || null,
        defaultStartTime: data.defaultStartTime || null,
        attendanceFormat: data.attendanceFormat || 'none',
        clientAttendanceRequired: data.clientAttendanceRequired ?? true,
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
    year?: string;
    month?: string;
    tenantId: string;
  }) {
    const { tenantId } = params;
    const page = params.page || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      params.limit || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const where: any = { tenantId, deletedAt: null };
    if (params.status) {
      where.status = params.status;
    }
    const targetYear = Number(params.year);
    const targetMonth = Number(params.month);
    if (
      Number.isInteger(targetYear) &&
      Number.isInteger(targetMonth) &&
      targetMonth >= 1 &&
      targetMonth <= 12
    ) {
      const monthStart = dateOnlyJst(targetYear, targetMonth, 1);
      const nextMonthStart =
        targetMonth === 12
          ? dateOnlyJst(targetYear + 1, 1, 1)
          : dateOnlyJst(targetYear, targetMonth + 1, 1);

      where.startDate = { lt: nextMonthStart };
      where.OR = [
        { endDate: null },
        { endDate: { gte: monthStart } },
      ];
      where.employee = {
        is: {
          hireDate: { lt: nextMonthStart },
          deletedAt: null,
        },
      };
    }

    const [data, total] = await Promise.all([
      this.db.assignment.findMany({
        where,
        include: {
          employee: {
            select: { id: true, lastName: true, firstName: true, employeeCode: true, hireDate: true },
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
   * アサイン更新
   *
   * M3: 単価系フィールド（contractPrice / settlementLower / settlementUpper）に変更があった場合、
   * AssignmentRateHistory に改定履歴を1件追加する。
   */
  async update(id: string, data: {
    projectName?: string;
    contractPrice?: number;
    settlementLower?: number;
    settlementUpper?: number;
    overtimeRate?: number | null;
    deductionRate?: number | null;
    workLocation?: string | null;
    area?: string | null;
    defaultStartTime?: string | null;
    attendanceFormat?: string;
    clientAttendanceRequired?: boolean;
    projectId?: string | null;
    startDate?: string;
    endDate?: string | null;
    supplyChain?: string | null;
    rateChangeReason?: string;
    rateChangeEffectiveFrom?: string;
    rateChangedBy?: string;
  }, tenantId: string) {
    // 現行の単価を取得（改定履歴判定用）
    const existing = await this.db.assignment.findFirst({
      where: { id, tenantId },
      select: {
        contractPrice: true,
        settlementLower: true,
        settlementUpper: true,
        overtimeRate: true,
        deductionRate: true,
      },
    });

    const updateData: Record<string, any> = {};
    if (data.projectName !== undefined) updateData.projectName = data.projectName;
    if (data.contractPrice !== undefined) updateData.contractPrice = data.contractPrice;
    if (data.settlementLower !== undefined) updateData.settlementLower = data.settlementLower;
    if (data.settlementUpper !== undefined) updateData.settlementUpper = data.settlementUpper;
    if (data.overtimeRate !== undefined) updateData.overtimeRate = data.overtimeRate;
    if (data.deductionRate !== undefined) updateData.deductionRate = data.deductionRate;
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.defaultStartTime !== undefined) updateData.defaultStartTime = data.defaultStartTime;
    if (data.attendanceFormat !== undefined) updateData.attendanceFormat = data.attendanceFormat;
    if (data.clientAttendanceRequired !== undefined) updateData.clientAttendanceRequired = data.clientAttendanceRequired;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    // M3: 単価改定があったら履歴を追加
    const rateChanged =
      existing &&
      ((data.contractPrice !== undefined && data.contractPrice !== existing.contractPrice) ||
        (data.settlementLower !== undefined && data.settlementLower !== existing.settlementLower) ||
        (data.settlementUpper !== undefined && data.settlementUpper !== existing.settlementUpper) ||
        (data.overtimeRate !== undefined && data.overtimeRate !== existing.overtimeRate) ||
        (data.deductionRate !== undefined && data.deductionRate !== existing.deductionRate));

    return this.db.$transaction(async (tx) => {
      const updated = await tx.assignment.updateMany({
        where: { id, tenantId },
        data: updateData,
      });

      if (updated.count === 0) {
        throw new NotFoundException('アサインが見つからないか、更新に失敗しました');
      }

      // データの取得（後続ロジック用）
      const refreshed = await tx.assignment.findFirst({
        where: { id, tenantId },
        include: {
          employee: {
            select: { id: true, lastName: true, firstName: true, employeeCode: true },
          },
          client: {
            select: { id: true, name: true },
          },
        },
      });

      if (!refreshed) throw new NotFoundException('アサインが見つかりません');

      if (rateChanged && existing) {
        await tx.assignmentRateHistory.create({
          data: {
            assignmentId: id,
            effectiveFrom: data.rateChangeEffectiveFrom
              ? new Date(data.rateChangeEffectiveFrom)
              : new Date(),
            contractPrice: data.contractPrice ?? existing.contractPrice,
            settlementLower: data.settlementLower ?? existing.settlementLower,
            settlementUpper: data.settlementUpper ?? existing.settlementUpper,
            overtimeRate: data.overtimeRate !== undefined ? data.overtimeRate : existing.overtimeRate,
            deductionRate: data.deductionRate !== undefined ? data.deductionRate : existing.deductionRate,
            reason: data.rateChangeReason ?? null,
            changedBy: data.rateChangedBy ?? null,
          },
        });
        this.logger.log(`M3: アサイン単価改定履歴を追加 (assignment=${id})`);
      }

      return refreshed;
    });
  }

  /**
   * アサインの単価改定履歴を取得（M3）
   */
  async getRateHistory(assignmentId: string, tenantId: string) {
    return this.db.assignmentRateHistory.findMany({
      where: { 
        assignmentId,
        assignment: { tenantId }
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * mode: 'scheduled' = 契約期間通り終了（endDateそのまま、ステータスending_scheduled）
   *        'immediate' = 途中終了（endDateを指定日に上書き、ステータスended）
   */
  async endAssignment(id: string, tenantId: string, data?: { mode?: string; endDate?: string; endReason?: string }) {
    const mode = data?.mode || 'immediate';
    const where = { id, tenantId };

    if (mode === 'scheduled') {
      // 契約期間通り終了 → 終了予定ステータスに変更（endDateはそのまま）
      const updated = await this.db.assignment.updateMany({
        where,
        data: {
          status: 'ending_scheduled',
          endReason: data?.endReason || 'term_end',
        },
      });
      if (updated.count === 0) throw new NotFoundException('アサインが見つかりません');
      return { id, status: 'ending_scheduled' };
    }

    // 途中終了 → 即終了
    const updated = await this.db.assignment.updateMany({
      where,
      data: {
        status: 'ended',
        endDate: data?.endDate ? new Date(data.endDate) : new Date(),
        endReason: data?.endReason || 'early_termination',
      },
    });
    if (updated.count === 0) throw new NotFoundException('アサインが見つかりません');
    return { id, status: 'ended' };
  }

  /**
   * 契約延長（endDateを更新）
   */
  async extendAssignment(id: string, tenantId: string, newEndDate: string) {
    const updated = await this.db.assignment.updateMany({
      where: { id, tenantId },
      data: {
        endDate: new Date(newEndDate),
        // ending_scheduledだった場合はactiveに戻す
        status: 'active',
      },
    });
    if (updated.count === 0) throw new NotFoundException('アサインが見つかりません');
    return { id, status: 'active', endDate: newEndDate };
  }

  /**
   * 現在の稼働先を取得
   *
   * status=active のアサインを返す。
   * クライアント情報（会社名・連絡先）もJOINで取得。
   * アサインがない場合はnullを返す（エラーにはしない）。
   */
  async getCurrentAssignment(employeeId: string, tenantId: string) {
    return this.db.assignment.findFirst({
      where: {
        employeeId,
        tenantId,
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
  async getHistory(employeeId: string, tenantId: string) {
    return this.db.assignment.findMany({
      where: {
        employeeId,
        tenantId,
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
