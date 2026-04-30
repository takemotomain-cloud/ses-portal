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
    corporateNumber?: string;
    invoiceNumber?: string;
    postalCode?: string;
    address?: string;
    representName?: string;
    establishedDate?: string;
    capital?: string;
    websiteUrl?: string;
    industry?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    tradeFlow?: string;
    billingEmail?: string;
    tradeStartDate?: string;
    // 支払サイクル
    closingDay?: number | null;
    paymentMode?: string | null;
    paymentMonths?: number | null;
    paymentDay?: number | null;
    paymentDays?: number | null;
    bankHolidayAdj?: string | null;
  }) {
    return this.db.client.create({
      data: {
        name: data.name,
        corporateNumber: data.corporateNumber || null,
        invoiceNumber: data.invoiceNumber || null,
        postalCode: data.postalCode || null,
        address: data.address || null,
        representName: data.representName || null,
        establishedDate: data.establishedDate || null,
        capital: data.capital || null,
        websiteUrl: data.websiteUrl || null,
        industry: data.industry || null,
        contactPerson: data.contactPerson || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        tradeFlow: data.tradeFlow || null,
        billingEmail: data.billingEmail || null,
        tradeStartDate: data.tradeStartDate
          ? new Date(data.tradeStartDate)
          : null,
        closingDay: data.closingDay ?? null,
        paymentMode: data.paymentMode ?? null,
        paymentMonths: data.paymentMonths ?? null,
        paymentDay: data.paymentDay ?? null,
        paymentDays: data.paymentDays ?? null,
        bankHolidayAdj: data.bankHolidayAdj ?? null,
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
   * クライアント更新
   */
  async update(
    id: string,
    data: {
      name?: string;
      corporateNumber?: string;
      invoiceNumber?: string;
      postalCode?: string;
      address?: string;
      representName?: string;
      establishedDate?: string;
      capital?: string;
      websiteUrl?: string;
      industry?: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      tradeFlow?: string;
      billingEmail?: string;
      tradeStartDate?: string;
      closingDay?: number | null;
      paymentMode?: string | null;
      paymentMonths?: number | null;
      paymentDay?: number | null;
      paymentDays?: number | null;
      bankHolidayAdj?: string | null;
    },
  ) {
    const client = await this.db.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('クライアントが見つかりません');
    }

    return this.db.client.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.corporateNumber !== undefined && { corporateNumber: data.corporateNumber || null }),
        ...(data.invoiceNumber !== undefined && { invoiceNumber: data.invoiceNumber || null }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.representName !== undefined && { representName: data.representName || null }),
        ...(data.establishedDate !== undefined && { establishedDate: data.establishedDate || null }),
        ...(data.capital !== undefined && { capital: data.capital || null }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl || null }),
        ...(data.industry !== undefined && { industry: data.industry || null }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson || null }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone || null }),
        ...(data.tradeFlow !== undefined && { tradeFlow: data.tradeFlow || null }),
        ...(data.billingEmail !== undefined && { billingEmail: data.billingEmail || null }),
        ...(data.tradeStartDate !== undefined && {
          tradeStartDate: data.tradeStartDate ? new Date(data.tradeStartDate) : null,
        }),
        ...(data.closingDay !== undefined && { closingDay: data.closingDay }),
        ...(data.paymentMode !== undefined && { paymentMode: data.paymentMode }),
        ...(data.paymentMonths !== undefined && { paymentMonths: data.paymentMonths }),
        ...(data.paymentDay !== undefined && { paymentDay: data.paymentDay }),
        ...(data.paymentDays !== undefined && { paymentDays: data.paymentDays }),
        ...(data.bankHolidayAdj !== undefined && { bankHolidayAdj: data.bankHolidayAdj }),
      },
    });
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
