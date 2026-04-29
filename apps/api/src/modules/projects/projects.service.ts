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

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly db: DatabaseService) {}

  /** クライアントの案件一覧（assignments含む） */
  async findByClient(clientId: string) {
    return this.db.project.findMany({
      where: { clientId, deletedAt: null },
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
  async findOne(id: string) {
    const project = await this.db.project.findFirst({
      where: { id, deletedAt: null },
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
    startDate?: string;
    endDate?: string;
    workLocation?: string;
    area?: string;
    defaultStartTime?: string;
    attendanceFormat?: string;
    supplyChain?: string;
    note?: string;
  }) {
    const project = await this.db.project.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        contractPrice: data.contractPrice || null,
        rewardRate: data.rewardRate || null,
        settlementLower: data.settlementLower || null,
        settlementUpper: data.settlementUpper || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        workLocation: data.workLocation || null,
        area: data.area || null,
        defaultStartTime: data.defaultStartTime || null,
        attendanceFormat: data.attendanceFormat || 'none',
        supplyChain: data.supplyChain || null,
        note: data.note || null,
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
    startDate?: string | null;
    endDate?: string | null;
    workLocation?: string | null;
    area?: string | null;
    defaultStartTime?: string | null;
    attendanceFormat?: string;
    supplyChain?: string | null;
    note?: string | null;
  }) {
    const existing = await this.findOne(id);

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.contractPrice !== undefined) updateData.contractPrice = data.contractPrice;
    if (data.rewardRate !== undefined) updateData.rewardRate = data.rewardRate;
    if (data.settlementLower !== undefined) updateData.settlementLower = data.settlementLower;
    if (data.settlementUpper !== undefined) updateData.settlementUpper = data.settlementUpper;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.defaultStartTime !== undefined) updateData.defaultStartTime = data.defaultStartTime;
    if (data.attendanceFormat !== undefined) updateData.attendanceFormat = data.attendanceFormat;
    if (data.supplyChain !== undefined) updateData.supplyChain = data.supplyChain;
    if (data.note !== undefined) updateData.note = data.note;

    const updated = await this.db.project.update({
      where: { id },
      data: updateData,
    });

    // M1: 案件の endDate が過去 or 本日以前に設定された場合、紐づくアクティブなアサインを自動で ended 化
    const newEndDate = updateData.endDate ?? existing.endDate;
    if (newEndDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(newEndDate);
      end.setHours(0, 0, 0, 0);

      if (end <= today) {
        const closed = await this.db.assignment.updateMany({
          where: {
            projectId: id,
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

    return updated;
  }

  /**
   * 案件削除（論理削除）
   *
   * M4: 関連アサインは残す（過去の稼働実績・給与履歴保護のため）
   */
  async remove(id: string) {
    await this.findOne(id);
    await this.db.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`案件削除: ${id}（関連アサインは保持）`);
  }
}
