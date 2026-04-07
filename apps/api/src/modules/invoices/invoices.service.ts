import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(month?: string) {
    return this.db.invoice.findMany({
      where: month ? { targetMonth: month } : undefined,
      include: {
        client: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.db.invoice.findFirst({
      where: { id },
      include: {
        client: { select: { id: true, name: true, address: true, contactPerson: true, contactEmail: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!invoice) throw new NotFoundException('請求書が見つかりません');
    return invoice;
  }

  async create(data: {
    clientId: string;
    targetMonth: string;
    invoiceDate: string;
    dueDate: string;
    recipientEmail?: string;
    notes?: string;
    items: {
      employeeName: string;
      description: string;
      workHours?: number;
      unitPrice: number;
      settlementLower?: number;
      settlementUpper?: number;
      overtimeAmount?: number;
      deductionAmount?: number;
      subtotal: number;
    }[];
  }) {
    // 請求番号の自動生成
    const count = await this.db.invoice.count();
    const invoiceNo = `INV-${String(count + 1).padStart(5, '0')}`;
    const totalAmount = data.items.reduce((s, i) => s + i.subtotal, 0);
    const tax = Math.floor(totalAmount * 0.1);

    return this.db.invoice.create({
      data: {
        invoiceNo,
        clientId: data.clientId,
        targetMonth: data.targetMonth,
        totalAmount,
        tax,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        recipientEmail: data.recipientEmail || null,
        notes: data.notes || null,
        items: {
          create: data.items.map((item, idx) => ({
            employeeName: item.employeeName,
            description: item.description,
            workHours: item.workHours ?? null,
            unitPrice: item.unitPrice,
            settlementLower: item.settlementLower ?? null,
            settlementUpper: item.settlementUpper ?? null,
            overtimeAmount: item.overtimeAmount ?? 0,
            deductionAmount: item.deductionAmount ?? 0,
            subtotal: item.subtotal,
            sortOrder: idx,
          })),
        },
      },
      include: { client: { select: { id: true, name: true } }, items: true },
    });
  }

  async updateStatus(id: string, status: string) {
    const now = new Date();
    return this.db.invoice.update({
      where: { id },
      data: {
        status,
        ...(status === 'sent' ? { sentAt: now } : {}),
        ...(status === 'paid' ? { paidAt: now } : {}),
      },
    });
  }
}
