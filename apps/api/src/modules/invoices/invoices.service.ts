import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  resolvePaymentTerm,
  computeDueDate,
} from '../payment-terms/payment-terms.util';

/* ── 型定義 ── */

interface SettlementResult {
  baseAmount: number;
  overtimeAmount: number;
  deductionAmount: number;
  subtotal: number;
}

export interface BillableEmployee {
  employeeId: string;
  employeeName: string;
  assignmentId: string;
  projectName: string;
  contractPrice: number;
  settlementLower: number;
  settlementUpper: number;
  totalWorkMinutes: number;
  totalWorkHours: number;
  baseAmount: number;
  overtimeAmount: number;
  deductionAmount: number;
  subtotal: number;
}

export interface BillableGroup {
  clientId: string;
  clientName: string;
  targetMonth: string;
  employees: BillableEmployee[];
  totalAmount: number;
  employeeCount: number;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly db: DatabaseService) {}

  /* ================================================================== */
  /*  既存メソッド                                                        */
  /* ================================================================== */

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
        client: { select: { id: true, name: true, address: true, postalCode: true, contactPerson: true, contactEmail: true, invoiceNumber: true, representName: true } },
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
    const invoiceNo = await this.generateInvoiceNo();
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

  async update(id: string, data: {
    invoiceDate?: string;
    dueDate?: string;
    notes?: string;
    items?: {
      id?: string;
      employeeName: string;
      description: string;
      workHours?: number;
      unitPrice: number;
      settlementLower?: number;
      settlementUpper?: number;
      overtimeAmount?: number;
      deductionAmount?: number;
      subtotal?: number;
      employeeId?: string;
      assignmentId?: string;
    }[];
  }) {
    const invoice = await this.db.invoice.findFirst({ where: { id } });
    if (!invoice) throw new NotFoundException('請求書が見つかりません');

    // 明細の再計算
    let totalAmount = invoice.totalAmount;
    if (data.items) {
      // 各明細の精算計算（手動値があれば優先）
      const processedItems = data.items.map((item, idx) => {
        const wh = item.workHours ?? 0;
        const lower = item.settlementLower ?? 0;
        const upper = item.settlementUpper ?? 0;
        const settlement = this.calculateSettlement(wh, item.unitPrice, lower, upper);
        const ot = (item.overtimeAmount !== undefined && item.overtimeAmount !== null) ? item.overtimeAmount : settlement.overtimeAmount;
        const ded = (item.deductionAmount !== undefined && item.deductionAmount !== null) ? item.deductionAmount : settlement.deductionAmount;
        const sub = item.unitPrice + ot - ded;
        return {
          employeeName: item.employeeName,
          description: item.description,
          workHours: item.workHours ?? null,
          unitPrice: item.unitPrice,
          settlementLower: item.settlementLower ?? null,
          settlementUpper: item.settlementUpper ?? null,
          overtimeAmount: ot,
          deductionAmount: ded,
          subtotal: sub,
          sortOrder: idx,
          employeeId: item.employeeId ?? null,
          assignmentId: item.assignmentId ?? null,
        };
      });
      totalAmount = processedItems.reduce((s, i) => s + i.subtotal, 0);
      const tax = Math.floor(totalAmount * 0.1);

      // 既存明細を削除して再作成
      await this.db.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return this.db.invoice.update({
        where: { id },
        data: {
          totalAmount,
          tax,
          ...(data.invoiceDate ? { invoiceDate: new Date(data.invoiceDate) } : {}),
          ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
          ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
          items: { create: processedItems },
        },
        include: {
          client: { select: { id: true, name: true, address: true, postalCode: true, contactPerson: true, contactEmail: true, invoiceNumber: true, representName: true } },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });
    }

    // 明細変更なし: ヘッダー情報のみ更新
    return this.db.invoice.update({
      where: { id },
      data: {
        ...(data.invoiceDate ? { invoiceDate: new Date(data.invoiceDate) } : {}),
        ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
      include: {
        client: { select: { id: true, name: true, address: true, postalCode: true, contactPerson: true, contactEmail: true, invoiceNumber: true, representName: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
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

  /* ================================================================== */
  /*  請求発行可能一覧                                                     */
  /* ================================================================== */

  /**
   * 対象月に勤怠確定済みでまだ請求書未発行の社員をクライアント別にグルーピングして返す
   */
  async getBillableEmployees(month: string): Promise<{ billableGroups: BillableGroup[] }> {
    // 対象月の日付範囲
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0); // 月末日

    // 1. 対象月に確定済み勤怠がある社員IDを集約
    const confirmedRecords = await this.db.attendanceConfirmed.groupBy({
      by: ['employeeId'],
      where: {
        workDate: { gte: startDate, lte: endDate },
        confirmedAt: { not: null },
      },
      _sum: { workMinutes: true },
    });

    if (confirmedRecords.length === 0) {
      return { billableGroups: [] };
    }

    const employeeIds = confirmedRecords.map((r) => r.employeeId);

    // 2. 各社員のアクティブなアサイン情報を取得
    const assignments = await this.db.assignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: ['active', 'ending_scheduled'] },
        startDate: { lte: endDate },
        OR: [
          { endDate: null },
          { endDate: { gte: startDate } },
        ],
      },
      include: {
        employee: { select: { id: true, lastName: true, firstName: true } },
        client: { select: { id: true, name: true } },
      },
    });

    if (assignments.length === 0) {
      return { billableGroups: [] };
    }

    // 3. 既に請求書発行済みの社員を除外（同月の InvoiceItem.employeeId）
    const existingItems = await this.db.invoiceItem.findMany({
      where: {
        employeeId: { in: employeeIds },
        invoice: { targetMonth: month },
      },
      select: { employeeId: true, assignmentId: true },
    });
    const billedKeys = new Set(
      existingItems.map((i) => `${i.employeeId}_${i.assignmentId || ''}`),
    );

    // 4. 各アサインメントの精算計算
    const workMinutesMap = new Map<string, number>();
    for (const r of confirmedRecords) {
      workMinutesMap.set(r.employeeId, Number(r._sum.workMinutes || 0));
    }

    // クライアントごとにグルーピング
    const groupMap = new Map<string, { client: { id: string; name: string }; employees: BillableEmployee[] }>();

    for (const assignment of assignments) {
      const key = `${assignment.employeeId}_${assignment.id}`;
      if (billedKeys.has(key)) continue; // 既に請求済み

      const totalMinutes = workMinutesMap.get(assignment.employeeId) || 0;
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      // 当月有効な単価を取得
      const rate = await this.getEffectiveRate(assignment.id, endDate);
      const contractPrice = rate?.contractPrice ?? assignment.contractPrice;
      const lower = rate?.settlementLower ?? assignment.settlementLower;
      const upper = rate?.settlementUpper ?? assignment.settlementUpper;
      const overtimeRate = rate?.overtimeRate ?? assignment.overtimeRate ?? null;
      const deductionRate = rate?.deductionRate ?? assignment.deductionRate ?? null;

      const settlement = this.calculateSettlement(totalHours, contractPrice, lower, upper, overtimeRate, deductionRate);

      const emp: BillableEmployee = {
        employeeId: assignment.employeeId,
        employeeName: `${assignment.employee.lastName} ${assignment.employee.firstName}`,
        assignmentId: assignment.id,
        projectName: assignment.projectName,
        contractPrice,
        settlementLower: lower,
        settlementUpper: upper,
        totalWorkMinutes: totalMinutes,
        totalWorkHours: totalHours,
        ...settlement,
      };

      if (!groupMap.has(assignment.clientId)) {
        groupMap.set(assignment.clientId, { client: assignment.client, employees: [] });
      }
      groupMap.get(assignment.clientId)!.employees.push(emp);
    }

    // 結果を組み立て
    const billableGroups: BillableGroup[] = [];
    for (const [clientId, group] of groupMap) {
      const totalAmount = group.employees.reduce((s, e) => s + e.subtotal, 0);
      billableGroups.push({
        clientId,
        clientName: group.client.name,
        targetMonth: month,
        employees: group.employees,
        totalAmount,
        employeeCount: group.employees.length,
      });
    }

    // クライアント名でソート
    billableGroups.sort((a, b) => a.clientName.localeCompare(b.clientName));

    return { billableGroups };
  }

  /* ================================================================== */
  /*  勤怠ベース請求書発行                                                  */
  /* ================================================================== */

  async generateFromAttendance(data: {
    clientId: string;
    targetMonth: string;
    employeeIds: string[];
    invoiceDate?: string;
    dueDate?: string;
    notes?: string;
  }) {
    const { clientId, targetMonth, employeeIds } = data;

    if (!employeeIds.length) {
      throw new BadRequestException('対象社員を選択してください');
    }

    // 対象月の日付範囲
    const [year, mon] = targetMonth.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0);

    // 二重発行チェック
    const existingItems = await this.db.invoiceItem.findMany({
      where: {
        employeeId: { in: employeeIds },
        invoice: { targetMonth, clientId },
      },
      select: { employeeId: true },
    });
    if (existingItems.length > 0) {
      const dupeIds = [...new Set(existingItems.map((i) => i.employeeId))];
      throw new BadRequestException(
        `以下の社員は既にこの月の請求書に含まれています: ${dupeIds.length}名`,
      );
    }

    // 各社員のアサインメント・勤怠・精算計算
    const items: {
      employeeName: string;
      description: string;
      workHours: number;
      unitPrice: number;
      settlementLower: number;
      settlementUpper: number;
      overtimeAmount: number;
      deductionAmount: number;
      subtotal: number;
      employeeId: string;
      assignmentId: string;
    }[] = [];

    for (const empId of employeeIds) {
      // アサイン取得
      const assignment = await this.db.assignment.findFirst({
        where: {
          employeeId: empId,
          clientId,
          status: { in: ['active', 'ending_scheduled'] },
          startDate: { lte: endDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
        include: {
          employee: { select: { lastName: true, firstName: true } },
        },
      });

      if (!assignment) {
        throw new BadRequestException(
          `社員ID ${empId} の対象クライアントへの有効なアサインメントが見つかりません`,
        );
      }

      // 確定済み勤怠時間の集計
      const totalMinutes = await this.aggregateConfirmedMinutes(empId, startDate, endDate);
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      // 当月有効単価
      const rate = await this.getEffectiveRate(assignment.id, endDate);
      const contractPrice = rate?.contractPrice ?? assignment.contractPrice;
      const lower = rate?.settlementLower ?? assignment.settlementLower;
      const upper = rate?.settlementUpper ?? assignment.settlementUpper;
      const overtimeRate = rate?.overtimeRate ?? assignment.overtimeRate ?? null;
      const deductionRate = rate?.deductionRate ?? assignment.deductionRate ?? null;

      const settlement = this.calculateSettlement(totalHours, contractPrice, lower, upper, overtimeRate, deductionRate);

      items.push({
        employeeName: `${assignment.employee.lastName} ${assignment.employee.firstName}`,
        description: assignment.projectName,
        workHours: totalHours,
        unitPrice: contractPrice,
        settlementLower: lower,
        settlementUpper: upper,
        overtimeAmount: settlement.overtimeAmount,
        deductionAmount: settlement.deductionAmount,
        subtotal: settlement.subtotal,
        employeeId: empId,
        assignmentId: assignment.id,
      });
    }

    // 請求書番号生成
    const invoiceNo = await this.generateInvoiceNo();
    const totalAmount = items.reduce((s, i) => s + i.subtotal, 0);
    const tax = Math.floor(totalAmount * 0.1);

    // 請求日・支払期日
    const invoiceDate = data.invoiceDate
      ? new Date(data.invoiceDate)
      : new Date();

    // クライアント取得（支払サイクル設定 + billingEmail）
    const client = await this.db.client.findUnique({
      where: { id: clientId },
      select: {
        billingEmail: true,
        closingDay: true,
        paymentMode: true,
        paymentMonths: true,
        paymentDay: true,
        paymentDays: true,
        bankHolidayAdj: true,
      },
    });

    // 案件の支払サイクル上書き判定（最初の社員の有効アサインから案件を引く）
    let projectTerm: {
      closingDay: number | null;
      paymentMode: string | null;
      paymentMonths: number | null;
      paymentDay: number | null;
      paymentDays: number | null;
      bankHolidayAdj: string | null;
    } | null = null;
    if (employeeIds.length > 0) {
      const firstAssignment = await this.db.assignment.findFirst({
        where: {
          employeeId: employeeIds[0],
          clientId,
          status: { in: ['active', 'ending_scheduled'] },
        },
        select: { projectId: true },
      });
      if (firstAssignment?.projectId) {
        projectTerm = await this.db.project.findUnique({
          where: { id: firstAssignment.projectId },
          select: {
            closingDay: true,
            paymentMode: true,
            paymentMonths: true,
            paymentDay: true,
            paymentDays: true,
            bankHolidayAdj: true,
          },
        });
      }
    }

    let dueDate: Date;
    if (data.dueDate) {
      // 明示指定あり → そのまま採用
      dueDate = new Date(data.dueDate);
    } else {
      const term = resolvePaymentTerm(projectTerm, client);
      dueDate = term
        ? computeDueDate(targetMonth, term)
        : new Date(year, mon, 0); // フォールバック: 翌月末
    }

    // トランザクション内で Invoice + InvoiceItem を一括作成
    const invoice = await this.db.invoice.create({
      data: {
        invoiceNo,
        clientId,
        targetMonth,
        totalAmount,
        tax,
        invoiceDate,
        dueDate,
        recipientEmail: client?.billingEmail || null,
        notes: data.notes || null,
        items: {
          create: items.map((item, idx) => ({
            employeeName: item.employeeName,
            description: item.description,
            workHours: item.workHours,
            unitPrice: item.unitPrice,
            settlementLower: item.settlementLower,
            settlementUpper: item.settlementUpper,
            overtimeAmount: item.overtimeAmount,
            deductionAmount: item.deductionAmount,
            subtotal: item.subtotal,
            sortOrder: idx,
            employeeId: item.employeeId,
            assignmentId: item.assignmentId,
          })),
        },
      },
      include: {
        client: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return invoice;
  }

  /* ================================================================== */
  /*  プライベートメソッド                                                  */
  /* ================================================================== */

  /** 請求番号を自動生成（INV-00001形式） */
  private async generateInvoiceNo(): Promise<string> {
    const count = await this.db.invoice.count();
    return `INV-${String(count + 1).padStart(5, '0')}`;
  }

  /** 対象月末時点で有効な単価を取得 */
  private async getEffectiveRate(
    assignmentId: string,
    targetDate: Date,
  ): Promise<{
    contractPrice: number;
    settlementLower: number;
    settlementUpper: number;
    overtimeRate: number | null;
    deductionRate: number | null;
  } | null> {
    const history = await this.db.assignmentRateHistory.findFirst({
      where: {
        assignmentId,
        effectiveFrom: { lte: targetDate },
      },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        contractPrice: true,
        settlementLower: true,
        settlementUpper: true,
        overtimeRate: true,
        deductionRate: true,
      },
    });
    return history;
  }

  /** 確定済み勤怠の合計稼働分を集計 */
  private async aggregateConfirmedMinutes(
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.db.attendanceConfirmed.aggregate({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
        confirmedAt: { not: null },
      },
      _sum: { workMinutes: true },
    });
    return Number(result._sum.workMinutes || 0);
  }

  /**
   * SES精算計算
   *
   * 案件別に超過・控除の1時間単価が設定されていればそれを優先する。
   * 未設定（null/0）の場合は contractPrice / settlement{Upper,Lower} で自動計算（後方互換）。
   */
  private calculateSettlement(
    workHours: number,
    contractPrice: number,
    settlementLower: number,
    settlementUpper: number,
    overtimeRate?: number | null,
    deductionRate?: number | null,
  ): SettlementResult {
    const baseAmount = contractPrice;
    let overtimeAmount = 0;
    let deductionAmount = 0;

    if (settlementUpper > 0 && workHours > settlementUpper) {
      // 超過精算: 案件別単価が設定されていればそれを使用、無ければ contractPrice / settlementUpper
      const rate = overtimeRate && overtimeRate > 0
        ? overtimeRate
        : contractPrice / settlementUpper;
      overtimeAmount = Math.round((workHours - settlementUpper) * rate);
    }

    if (settlementLower > 0 && workHours < settlementLower) {
      // 控除: 案件別単価が設定されていればそれを使用、無ければ contractPrice / settlementLower
      const rate = deductionRate && deductionRate > 0
        ? deductionRate
        : contractPrice / settlementLower;
      deductionAmount = Math.round((settlementLower - workHours) * rate);
    }

    return {
      baseAmount,
      overtimeAmount,
      deductionAmount,
      subtotal: baseAmount + overtimeAmount - deductionAmount,
    };
  }
}
