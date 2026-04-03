/**
 * Clients Service
 *
 * クライアント（取引先）のビジネスロジック。
 *
 * 機能:
 * - create: 新規クライアント登録
 * - findAll: クライアント一覧（ページネーション対応）
 * - findOne: クライアント詳細
 *
 * セキュリティ: admin/salesロールのみ利用可能（コントローラー側で制御）
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PAGINATION } from '@ses-portal/shared';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * クライアント新規作成
   */
  async create(data: {
    name: string;
    industry?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    tradeFlow?: string;
    billingEmail?: string;
    tradeStartDate?: string;
  }) {
    return this.db.client.create({
      data: {
        name: data.name,
        industry: data.industry || null,
        contactPerson: data.contactPerson || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        address: data.address || null,
        tradeFlow: data.tradeFlow || null,
        billingEmail: data.billingEmail || null,
        tradeStartDate: data.tradeStartDate
          ? new Date(data.tradeStartDate)
          : null,
      },
    });
  }

  /**
   * クライアント一覧を取得
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = params.page || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      params.limit || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { contactPerson: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.client.findMany({
        where,
        include: {
          assignments: {
            where: { status: 'active', deletedAt: null },
            select: {
              id: true,
              projectName: true,
              contractPrice: true,
              startDate: true,
              employee: {
                select: {
                  id: true,
                  lastName: true,
                  firstName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.client.count({ where }),
    ]);

    return {
      data: data.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        contactPerson: c.contactPerson,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        tradeFlow: c.tradeFlow,
        billingEmail: c.billingEmail,
        tradeStartDate: c.tradeStartDate,
        memberCount: c.assignments.length,
        monthlyRevenue: c.assignments.reduce(
          (sum, a) => sum + a.contractPrice,
          0,
        ),
        activeMembers: c.assignments.map((a) => ({
          name: `${a.employee.lastName} ${a.employee.firstName}`,
          project: a.projectName,
          since: a.startDate,
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * クライアント詳細を取得
   */
  async findOne(id: string) {
    const client = await this.db.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignments: {
          where: { deletedAt: null },
          include: {
            employee: {
              select: {
                id: true,
                lastName: true,
                firstName: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('クライアントが見つかりません');
    }

    return client;
  }
}
