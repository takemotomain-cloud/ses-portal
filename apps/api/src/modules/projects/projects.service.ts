/**
 * Projects Service — 案件CRUD
 *
 * クライアントに紐づく案件を管理する。
 * 1案件に複数のAssignment（メンバー）が紐づく。
 */

import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const SYSTEM_TENANT_ID = process.env.SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly db: DatabaseService) {}

  /** クライアントの案件一覧（assignments含む） */
  async findByClient(clientId: string, tenantId: string) {
    return this.db.project.findMany({
      where: { clientId, tenantId, deletedAt: null },
      include: {
        assignments: {
          where: { deletedAt: null },
          include: {
            employee: {
              select: {
                id: true,
                lastName: true,
                firstName: true,
                employeeCode: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 案件詳細 */
  async findOne(id: string, tenantId: string) {
    const project = await this.db.project.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
        assignments: {
          where: { deletedAt: null },
          include: {
            employee: {
              select: {
                id: true,
                lastName: true,
                firstName: true,
                employeeCode: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!project) throw new NotFoundException('案件が見つかりません');
    return project;
  }

  /** 案件作成 */
  async create(data: {
    clientId: string;
    name: string;
    contractPrice?: number;
    rewardRate?: string;
    settlementLower?: number;
    settlementUpper?: number;
    overtimeRate?: number;
    deductionRate?: number;
    startDate?: string;
    endDate?: string;
    workLocation?: string;
    area?: string;
    defaultStartTime?: string;
    attendanceFormat?: string;
    clientAttendanceRequired?: boolean;
    supplyChain?: string;
    note?: string;
    // 支払サイクル上書き
    closingDay?: number | null;
    paymentMode?: string | null;
    paymentMonths?: number | null;
    paymentDay?: number | null;
    paymentDays?: number | null;
    bankHolidayAdj?: string | null;
  }, tenantId: string) {
    const project = await this.db.project.create({
      data: {
        tenantId,
        clientId: data.clientId,
        name: data.name,
        contractPrice: data.contractPrice || null,
        rewardRate: data.rewardRate || null,
        settlementLower: data.settlementLower || null,
        settlementUpper: data.settlementUpper || null,
        overtimeRate: data.overtimeRate ?? null,
        deductionRate: data.deductionRate ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        workLocation: data.workLocation || null,
        area: data.area || null,
        defaultStartTime: data.defaultStartTime || null,
        attendanceFormat: data.attendanceFormat || 'none',
        clientAttendanceRequired:
          data.clientAttendanceRequired ?? true,
        supplyChain: data.supplyChain || null,
        note: data.note || null,
        closingDay: data.closingDay ?? null,
        paymentMode: data.paymentMode ?? null,
        paymentMonths: data.paymentMonths ?? null,
        paymentDay: data.paymentDay ?? null,
        paymentDays: data.paymentDays ?? null,
        bankHolidayAdj: data.bankHolidayAdj ?? null,
      },
    });
    this.logger.log(`案件作成: ${project.name} (${project.id})`);
    return project;
  }

  /** 案件更新 */
  async update(id: string, data: {
    name?: string;
    contractPrice?: number | null;
    rewardRate?: string | null;
    settlementLower?: number | null;
    settlementUpper?: number | null;
    overtimeRate?: number | null;
    deductionRate?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    workLocation?: string | null;
    area?: string | null;
    defaultStartTime?: string | null;
    attendanceFormat?: string;
    clientAttendanceRequired?: boolean;
    supplyChain?: string | null;
    note?: string | null;
    closingDay?: number | null;
    paymentMode?: string | null;
    paymentMonths?: number | null;
    paymentDay?: number | null;
    paymentDays?: number | null;
    bankHolidayAdj?: string | null;
  }, tenantId: string) {
    const existing = await this.findOne(id, tenantId);

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.contractPrice !== undefined) updateData.contractPrice = data.contractPrice;
    if (data.rewardRate !== undefined) updateData.rewardRate = data.rewardRate;
    if (data.settlementLower !== undefined) updateData.settlementLower = data.settlementLower;
    if (data.settlementUpper !== undefined) updateData.settlementUpper = data.settlementUpper;
    if (data.overtimeRate !== undefined) updateData.overtimeRate = data.overtimeRate;
    if (data.deductionRate !== undefined) updateData.deductionRate = data.deductionRate;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.defaultStartTime !== undefined) updateData.defaultStartTime = data.defaultStartTime;
    if (data.attendanceFormat !== undefined) updateData.attendanceFormat = data.attendanceFormat;
    if (data.clientAttendanceRequired !== undefined) updateData.clientAttendanceRequired = data.clientAttendanceRequired;
    if (data.supplyChain !== undefined) updateData.supplyChain = data.supplyChain;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.closingDay !== undefined) updateData.closingDay = data.closingDay;
    if (data.paymentMode !== undefined) updateData.paymentMode = data.paymentMode;
    if (data.paymentMonths !== undefined) updateData.paymentMonths = data.paymentMonths;
    if (data.paymentDay !== undefined) updateData.paymentDay = data.paymentDay;
    if (data.paymentDays !== undefined) updateData.paymentDays = data.paymentDays;
    if (data.bankHolidayAdj !== undefined) updateData.bankHolidayAdj = data.bankHolidayAdj;

    const updated = await this.db.project.updateMany({
      where: { id, tenantId },
      data: updateData,
    });

    if (updated.count === 0) {
      throw new NotFoundException('案件が見つからないか、更新に失敗しました');
    }

    // 更新後のデータを取得して返す（M1ロジックのため）
    const refreshed = await this.findOne(id, tenantId);

    // M1: 案件の endDate が過去 or 本日以前に設定された場合、紐づくアクティブなアサインを自動で ended 化
    const newEndDate = updateData.endDate ?? refreshed.endDate;
    if (newEndDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(newEndDate);
      end.setHours(0, 0, 0, 0);

      if (end <= today) {
        const closed = await this.db.assignment.updateMany({
          where: {
            projectId: id,
            tenantId,
            status: 'active',
            deletedAt: null,
          },
          data: {
            status: 'ended',
            endReason: 'project_ended',
            endDate: end,
          },
        });
        if (closed.count > 0) {
          this.logger.log(`M1: 案件終了に伴いアサイン ${closed.count} 件を ended 化（project=${id}）`);
        }
      }
    }

    return refreshed;
  }

  /**
   * 案件削除（論理削除）
   *
   * M4: 関連アサインは残す（過去の稼働実績・給与履歴保護のため）
   */
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.db.project.updateMany({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`案件削除: ${id}（関連アサインは保持）`);
  }
}
