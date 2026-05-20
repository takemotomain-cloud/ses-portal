/**
 * Settings Service
 *
 * 部署・役職のCRUDビジネスロジック。
 * 管理者のみ利用可能（コントローラー側で制御）。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly db: DatabaseService) {}

  /* ========== 部署 ========== */

  /**
   * 部署一覧を取得（ツリー構造）
   */
  async findAllDepartments(tenantId: string) {
    return this.db.department.findMany({
      where: { tenantId, isActive: true, parentId: null },
      include: {
        _count: { select: { employees: true } },
        children: {
          where: { tenantId, isActive: true },
          include: {
            _count: { select: { employees: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 部署を新規作成
   */
  async createDepartment(data: {
    name: string;
    code: string;
    parentId?: string;
  }, tenantId: string) {
    return this.db.department.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        parentId: data.parentId || null,
      },
    });
  }

  /* ========== 役職 ========== */

  /**
   * 役職一覧を取得
   */
  async findAllPositions(tenantId: string) {
    return this.db.position.findMany({
      where: { tenantId },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { rank: 'asc' },
    });
  }

  /**
   * 役職を新規作成
   */
  async createPosition(data: {
    name: string;
    rank: number;
    hasApproval?: boolean;
  }, tenantId: string) {
    return this.db.position.create({
      data: {
        tenantId,
        name: data.name,
        rank: data.rank,
        hasApproval: data.hasApproval ?? false,
      },
    });
  }
}
