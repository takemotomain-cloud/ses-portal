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
    startDate?: string;
    endDate?: string;
    workLocation?: string;
    area?: string;
    defaultStartTime?: string;
    attendanceFormat?: string;
    note?: string;
  }) {
    const project = await this.db.project.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        workLocation: data.workLocation || null,
        area: data.area || null,
        defaultStartTime: data.defaultStartTime || null,
        attendanceFormat: data.attendanceFormat || 'none',
        note: data.note || null,
      },
    });
    this.logger.log(`案件作成: ${project.name} (${project.id})`);
    return project;
  }

  /** 案件更新 */
  async update(id: string, data: {
    name?: string;
    startDate?: string | null;
    endDate?: string | null;
    workLocation?: string | null;
    area?: string | null;
    defaultStartTime?: string | null;
    attendanceFormat?: string;
    note?: string | null;
  }) {
    await this.findOne(id);

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.workLocation !== undefined) updateData.workLocation = data.workLocation;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.defaultStartTime !== undefined) updateData.defaultStartTime = data.defaultStartTime;
    if (data.attendanceFormat !== undefined) updateData.attendanceFormat = data.attendanceFormat;
    if (data.note !== undefined) updateData.note = data.note;

    return this.db.project.update({
      where: { id },
      data: updateData,
    });
  }

  /** 案件削除（論理削除） */
  async remove(id: string) {
    await this.findOne(id);
    await this.db.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`案件削除: ${id}`);
  }
}
