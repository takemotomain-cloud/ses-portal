/**
 * Payroll Service — 給与計算ビジネスロジック
 *
 * 給与体系:
 *   基本給・固定残業代は社員マスタ（給与テーブル）から取得
 *   超過残業手当 = (基本給 ÷ 所定時間) × 1.25 × max(0, 実残業 - 固定残業)
 *   欠勤控除 = 基本給 ÷ 所定労働日数 × 欠勤日数（ノーワークノーペイ）
 *   管理監督者(isExecutive) = 残業代なし
 *
 * ワークフロー: 勤怠確認（→自動給与計算） → 確認・修正 → 確定・通知 → 振込
 *
 * セキュリティ: 給与データは管理者・経理のみ閲覧可能。
 * 社員は自分の給与明細のみ閲覧可能（GET /salary/:year/:month）。
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../../database/database.service';
import { AttendanceConfirmedEvent } from '../attendance/events/attendance-confirmed.event';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isHoliday } from '@holiday-jp/holiday_jp';
import { findGrade, calcHealthInsurance, calcPension } from './tables/standard-remuneration';
import { calcWithholdingTax } from './tables/income-tax-table';
import { calculateOvertimeBreakdown } from './utils/overtime-calculator';
import { checkOvertimeLimits } from './utils/overtime-limit-checker';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 月の所定労働日数を算出（土日 + 日本の祝日を除外）
   */
  private getBusinessDays(year: number, month: number): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      if (isHoliday(d)) continue;
      count++;
    }
    return count;
  }

  /**
   * 勤怠確定ステータスを返す（フロント用）
   */
  async getClosureStatus(year: number, month: number) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    // closureテーブルも確認（後方互換）
    const closure = await this.db.attendanceMonthlyClosure.findUnique({
      where: { yearMonth },
    });

    // SES（アサインあり）と社内（アサインなし）を分けて確定状態を確認
    const activeEmployeesWithAssignment = await this.db.employee.findMany({
      where: { status: 'active', deletedAt: null, user: { role: { not: 'admin' } } },
      select: {
        id: true,
        assignments: {
          where: {
            status: 'active',
            deletedAt: null,
            startDate: { lte: endDate },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
          take: 1,
        },
      },
    });

    const sesEmployeeIds = activeEmployeesWithAssignment
      .filter((e) => e.assignments.length > 0)
      .map((e) => e.id);
    const internalEmployeeIds = activeEmployeesWithAssignment
      .filter((e) => e.assignments.length === 0)
      .map((e) => e.id);

    const checkGroup = async (ids: string[]) => {
      if (ids.length === 0) return { unconfirmed: 0, noRecords: 0 };
      const unconfirmed = await this.db.attendance.count({
        where: {
          employeeId: { in: ids },
          workDate: { gte: startDate, lte: endDate },
          status: { not: 'confirmed' },
        },
      });
      const withRecords = await this.db.attendance.groupBy({
        by: ['employeeId'],
        where: {
          employeeId: { in: ids },
          workDate: { gte: startDate, lte: endDate },
        },
      });
      return { unconfirmed, noRecords: ids.length - withRecords.length };
    };

    const ses = await checkGroup(sesEmployeeIds);
    const internal = await checkGroup(internalEmployeeIds);

    const sesAllConfirmed = ses.unconfirmed === 0 && ses.noRecords === 0;
    const internalAllConfirmed = internal.unconfirmed === 0 && internal.noRecords === 0;
    const allConfirmed = sesAllConfirmed && internalAllConfirmed;

    return {
      yearMonth,
      isClosed: closure?.status === 'closed' || allConfirmed,
      closedAt: closure?.closedAt || null,
      hasPostCloseChanges: closure?.hasPostCloseChanges || false,
      sesUnconfirmed: !sesAllConfirmed,
      internalUnconfirmed: !internalAllConfirmed,
    };
  }

  /**
   * 社員自身の給与明細を取得
   */
  async getMyPayslip(employeeId: string, year: number, month: number) {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    const payroll = await this.db.payroll.findUnique({
      where: { employeeId_targetMonth: { employeeId, targetMonth } },
    });
    if (!payroll) throw new NotFoundException(`${year}年${month}月の給与明細はまだ作成されていません`);
    return payroll;
  }

  /**
   * 全社員の月次給与一覧（管理者用）
   *
   * E: 給与可視性マトリクス
   * - admin:   全員の金額を通常表示
   * - manager: admin / 他 manager の金額は null（フロントで `****`）
   * - member:  controller 側で弾かれる想定（admin+manager のみ到達）
   *
   * 自分自身の行は常に金額表示（/mypage/payroll とは別経路だが、画面上は揃える）。
   * `_masked: true` のフラグを付けて返し、フロントで ボタン非表示 の判定に使う。
   */
  async getMonthlyPayroll(
    year: number,
    month: number,
    viewer?: { role: string; employeeId: string; userId?: string },
  ) {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    const records = await this.db.payroll.findMany({
      where: { targetMonth },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            lastName: true,
            firstName: true,
            user: { select: { role: true } },
          },
        },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    // 監査ログ: 給与一覧閲覧
    if (viewer?.userId) {
      this.auditService.log({
        userId: viewer.userId,
        action: 'payroll.view',
        targetTable: 'payrolls',
        newValue: { targetMonth, viewerRole: viewer.role },
      }).catch(() => {}); // fire-and-forget
    }

    // viewer 未指定 or admin は無加工
    if (!viewer || viewer.role === 'admin') {
      return records.map((r: any) => ({ ...r, _masked: false }));
    }

    return records.map((r: any) => {
      const targetRole = r.employee?.user?.role ?? 'employee';
      const isSelf = r.employee?.id === viewer.employeeId;

      // manager: 自分 or admin/他 manager 以外 → 表示可
      //          admin / 他 manager（自分除く） → マスク
      let masked = false;
      if (viewer.role === 'manager') {
        if (!isSelf && (targetRole === 'admin' || targetRole === 'manager')) {
          masked = true;
        }
      } else if (viewer.role === 'member') {
        // member が到達することは通常ないが、防御的に:
        // 自分以外の admin/manager/member はすべてマスク
        if (!isSelf && (targetRole === 'admin' || targetRole === 'manager' || targetRole === 'member')) {
          masked = true;
        }
      }

      if (!masked) {
        return { ...r, _masked: false };
      }

      // マスク対象: 金額系フィールドをすべて null 化
      return {
        ...r,
        baseSalary: null,
        overtimePay: null,
        commuteAllowance: null,
        otherAllowance: null,
        grossSalary: null,
        healthInsurance: null,
        pension: null,
        employmentInsurance: null,
        incomeTax: null,
        residentTax: null,
        totalDeductions: null,
        netSalary: null,
        _masked: true,
      };
    });
  }

  /**
   * 給与計算を実行（管理者用）
   *
   * 処理フロー:
   * 1. 在籍中の全社員を取得
   * 2. 各社員のアクティブなアサインから契約単価を取得
   * 3. 契約単価 × 還元率 = 基本給
   * 4. 勤怠データから残業時間を取得 → 残業手当計算
   * 5. 社会保険料・税金を仮計算
   * 6. payrollsテーブルにUPSERT
   */
  async calculateMonthly(year: number, month: number) {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

    // J1: 料率マスタを取得（存在しなければデフォルト値で作成）
    const rateMaster = await this.db.rateMaster.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const employees = await this.db.employee.findMany({
      where: { status: 'active', deletedAt: null },
      include: {
        assignments: { where: { status: 'active', deletedAt: null }, take: 1 },
      },
    });

    let processedCount = 0;

    // 所定労働日数（土日祝除く）
    const businessDays = this.getBusinessDays(year, month);

    // 扶養人数を一括取得（N+1回避）
    const empIds = employees.map(e => e.id);
    const depCounts = await this.db.dependent.groupBy({
      by: ['employeeId'],
      where: { isActive: true, deletedAt: null, employeeId: { in: empIds } },
      _count: true,
    });
    const depCountMap = new Map(depCounts.map(d => [d.employeeId, d._count]));

    // 年間残業時間を算出するために過去11ヶ月分のpayrollを取得
    const pastMonths: string[] = [];
    for (let i = 1; i <= 11; i++) {
      const m = month - i;
      const y = m <= 0 ? year - 1 : year;
      const mm = m <= 0 ? m + 12 : m;
      pastMonths.push(`${y}-${String(mm).padStart(2, '0')}`);
    }
    const pastPayrolls = await this.db.payroll.findMany({
      where: { employeeId: { in: empIds }, targetMonth: { in: pastMonths } },
      select: { employeeId: true, overtimePay: true, regularOvertimePay: true, excessOvertimePay: true, lateNightPay: true, holidayPay: true },
    });
    // 社員ごとの過去残業時間（概算: 過去payrollのovertimePay合計から逆算は不正確なので、勤怠ベースで算出）
    const pastAttendances = await this.db.attendance.findMany({
      where: {
        employeeId: { in: empIds },
        workDate: {
          gte: new Date(year - 1, month - 1, 1), // 12ヶ月前
          lt: new Date(year, month - 1, 1),       // 当月初日の前
        },
      },
      select: { employeeId: true, overtimeMinutes: true },
    });
    const yearlyOtMap = new Map<string, number>();
    for (const att of pastAttendances) {
      yearlyOtMap.set(att.employeeId, (yearlyOtMap.get(att.employeeId) ?? 0) + (att.overtimeMinutes || 0));
    }

    // confirmed な給与レコードの社員IDを取得（上書き防止）
    const confirmedPayrolls = await this.db.payroll.findMany({
      where: { targetMonth, status: 'confirmed', employeeId: { in: empIds } },
      select: { employeeId: true },
    });
    const confirmedSet = new Set(confirmedPayrolls.map(p => p.employeeId));

    for (const emp of employees) {
      // 確定済みの給与はスキップ
      if (confirmedSet.has(emp.id)) continue;

      // 基本給・固定残業代は社員マスタから取得
      const baseSalary = emp.baseSalary || 0;
      const fixedOvertimePay = (emp as any).fixedOvertimePay || 0;
      const isExecutive = (emp as any).isExecutive === true;

      // 所定労働時間・固定残業時間
      const contractHours = emp.contractHours ?? 168;
      const fixedOvertime = emp.fixedOvertime ?? 20;

      // 勤怠データ取得
      const attendances = await this.db.attendance.findMany({
        where: {
          employeeId: emp.id,
          workDate: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0),
          },
        },
      });

      // 出勤日数（normal/confirmed/paid_leave/clockInあり）
      const actualWorkDays = attendances.filter(
        a => a.status === 'normal' || a.status === 'confirmed' || a.status === 'paid_leave' || a.clockIn !== null,
      ).length;

      // 欠勤控除: baseSalary ÷ 所定労働日数 × 欠勤日数（切り上げ = 労働者有利）
      const absenceDays = Math.max(0, businessDays - actualWorkDays);
      const absenceDeduction = absenceDays > 0 && businessDays > 0
        ? Math.ceil(baseSalary / businessDays * absenceDays)
        : 0;

      // --- 残業内訳計算（管理監督者はスキップ）---
      let overtimePay = 0;
      let regularOvertimePay = 0;
      let excessOvertimePay = 0;
      let lateNightPay = 0;
      let holidayPay = 0;
      let overtimeWarnings: string[] | null = null;

      if (!isExecutive) {
        const hourlyRate = contractHours > 0 ? baseSalary / contractHours : 0;

        // 残業内訳を計算
        const otBreakdown = calculateOvertimeBreakdown(attendances as any);

        // 固定残業分を差し引いた通常残業
        const regularOtHours = Math.max(0, otBreakdown.regularOtMinutes / 60 - fixedOvertime);
        regularOvertimePay = Math.round(hourlyRate * 1.25 * regularOtHours);
        excessOvertimePay = Math.round(hourlyRate * 1.50 * otBreakdown.excessOtMinutes / 60);
        lateNightPay = Math.round(hourlyRate * 0.25 * otBreakdown.lateNightMinutes / 60);
        holidayPay = Math.round(hourlyRate * 1.35 * otBreakdown.holidayMinutes / 60);
        overtimePay = regularOvertimePay + excessOvertimePay + lateNightPay + holidayPay;

        // 36協定チェック
        const monthlyOtMinutes = otBreakdown.regularOtMinutes + otBreakdown.excessOtMinutes
          + otBreakdown.lateNightMinutes + otBreakdown.holidayMinutes;
        const monthlyOtHours = monthlyOtMinutes / 60;
        const pastYearlyMinutes = yearlyOtMap.get(emp.id) ?? 0;
        const yearlyOtHours = (pastYearlyMinutes + monthlyOtMinutes) / 60;
        const limitCheck = checkOvertimeLimits(monthlyOtHours, yearlyOtHours);
        if (limitCheck.warnings.length > 0) {
          overtimeWarnings = limitCheck.warnings;
        }
      }

      // 通勤手当: 当月承認済みの経費申請を合算
      const approvedExpenses = await this.db.expenseItem.findMany({
        where: {
          expenseRequest: {
            employeeId: emp.id,
            targetMonth,
            status: 'approved',
          },
        },
      });
      const commuteAllowance = approvedExpenses.reduce((s, it) => s + (it.amount || 0), 0);

      // 総支給額 = 基本給 + 固定残業手当 - 欠勤控除 + 超過残業手当 + 通勤手当
      const grossSalary = baseSalary + fixedOvertimePay - absenceDeduction + overtimePay + commuteAllowance;

      // --- 社会保険料: 標準報酬月額テーブル or 社員別上書き ---
      let healthInsurance: number;
      let pension: number;
      if (emp.rateHealthInsurance === null || emp.rateHealthInsurance === undefined) {
        // 標準報酬月額テーブルから算出（報酬月額 = 基本給 + 固定残業手当）
        const monthlyRemuneration = baseSalary + fixedOvertimePay;
        const gradeInfo = findGrade(monthlyRemuneration);
        healthInsurance = calcHealthInsurance(gradeInfo.standardAmount);
        pension = calcPension(gradeInfo.standardAmount);
      } else {
        healthInsurance = Math.round(grossSalary * Number(emp.rateHealthInsurance));
        const pensionRate = emp.rateEmployeePension !== null && emp.rateEmployeePension !== undefined
          ? Number(emp.rateEmployeePension) : Number(rateMaster.employeePension);
        pension = Math.round(grossSalary * pensionRate);
      }

      // 雇用保険: grossSalary × 料率
      const empInsRate = emp.rateEmploymentInsurance !== null && emp.rateEmploymentInsurance !== undefined
        ? Number(emp.rateEmploymentInsurance)
        : Number(rateMaster.employmentInsurance);
      const employmentInsurance = Math.round(grossSalary * empInsRate);

      // --- 所得税: 源泉徴収税額表 or 社員別上書き ---
      let incomeTax: number;
      if (emp.rateIncomeTax === null || emp.rateIncomeTax === undefined) {
        // 課税対象額 = 総支給 - 社会保険料控除
        const taxableIncome = grossSalary - healthInsurance - pension - employmentInsurance;
        const dependents = depCountMap.get(emp.id) ?? 0;
        incomeTax = calcWithholdingTax(taxableIncome, dependents);
      } else {
        incomeTax = Math.round(grossSalary * Number(emp.rateIncomeTax));
      }

      // 住民税: 固定額
      const residentTaxFixed = emp.rateResidentTaxFixed !== null && emp.rateResidentTaxFixed !== undefined
        ? emp.rateResidentTaxFixed
        : rateMaster.residentTaxFixed;
      const residentTax = residentTaxFixed;

      const totalDeductions = healthInsurance + pension + employmentInsurance + incomeTax + residentTax;
      const netSalary = grossSalary - totalDeductions;

      // 標準報酬月額の等級情報
      const monthlyRem = baseSalary + fixedOvertimePay;
      const gradeResult = findGrade(monthlyRem);

      // UPSERT
      await this.db.payroll.upsert({
        where: { employeeId_targetMonth: { employeeId: emp.id, targetMonth } },
        create: {
          employeeId: emp.id, targetMonth, baseSalary, fixedOvertimePay,
          fixedOvertimeHours: fixedOvertime,
          absenceDeduction, overtimePay,
          regularOvertimePay, excessOvertimePay, lateNightPay, holidayPay,
          commuteAllowance, otherAllowance: 0, grossSalary,
          standardRemunerationGrade: gradeResult.grade,
          standardMonthlyRemuneration: gradeResult.standardAmount,
          healthInsurance, pension, employmentInsurance, incomeTax, residentTax,
          totalDeductions, netSalary,
          businessDays, actualWorkDays,
          overtimeWarnings: overtimeWarnings ? overtimeWarnings : undefined,
          status: 'draft',
        },
        update: {
          baseSalary, fixedOvertimePay,
          fixedOvertimeHours: fixedOvertime,
          absenceDeduction, overtimePay,
          regularOvertimePay, excessOvertimePay, lateNightPay, holidayPay,
          commuteAllowance, grossSalary,
          standardRemunerationGrade: gradeResult.grade,
          standardMonthlyRemuneration: gradeResult.standardAmount,
          healthInsurance, pension, employmentInsurance, incomeTax,
          residentTax, totalDeductions, netSalary,
          businessDays, actualWorkDays,
          overtimeWarnings: overtimeWarnings ? overtimeWarnings : undefined,
        },
      });

      processedCount++;
    }

    this.logger.log(`Payroll calculated for ${targetMonth}: ${processedCount} employees`);
    return { processedCount, targetMonth };
  }

  /**
   * 個別社員の給与を計算する（勤怠確定トリガー用）
   * confirmed の給与レコードがあればスキップ（上書き防止）
   */
  async calculateForEmployee(employeeId: string, year: number, month: number): Promise<{ calculated: boolean }> {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

    // confirmed の給与レコードはスキップ
    const existing = await this.db.payroll.findUnique({
      where: { employeeId_targetMonth: { employeeId, targetMonth } },
      select: { status: true },
    });
    if (existing?.status === 'confirmed') {
      this.logger.log(`Payroll already confirmed for ${employeeId} ${targetMonth}, skipping`);
      return { calculated: false };
    }

    // 社員データ取得
    const emp = await this.db.employee.findUnique({
      where: { id: employeeId },
      include: {
        assignments: { where: { status: 'active', deletedAt: null }, take: 1 },
      },
    });
    if (!emp || emp.status !== 'active' || emp.deletedAt) {
      this.logger.warn(`Employee ${employeeId} not active, skipping payroll calc`);
      return { calculated: false };
    }

    // 料率マスタ
    const rateMaster = await this.db.rateMaster.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const businessDays = this.getBusinessDays(year, month);

    // 扶養人数
    const depCount = await this.db.dependent.count({
      where: { employeeId, deletedAt: null },
    });

    // 過去11ヶ月の残業時間（36協定チェック用）
    const pastAttendances = await this.db.attendance.findMany({
      where: {
        employeeId,
        workDate: {
          gte: new Date(year - 1, month - 1, 1),
          lt: new Date(year, month - 1, 1),
        },
      },
      select: { overtimeMinutes: true },
    });
    const yearlyOtMinutes = pastAttendances.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);

    // --- 給与計算ロジック ---
    const baseSalary = emp.baseSalary || 0;
    const fixedOvertimePay = (emp as any).fixedOvertimePay || 0;
    const isExecutive = (emp as any).isExecutive === true;
    const contractHours = emp.contractHours ?? 168;
    const fixedOvertime = emp.fixedOvertime ?? 20;

    const attendances = await this.db.attendance.findMany({
      where: {
        employeeId: emp.id,
        workDate: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0),
        },
      },
    });

    const actualWorkDays = attendances.filter(
      a => a.status === 'normal' || a.status === 'confirmed' || a.status === 'paid_leave' || a.clockIn !== null,
    ).length;

    const absenceDays = Math.max(0, businessDays - actualWorkDays);
    const absenceDeduction = absenceDays > 0 && businessDays > 0
      ? Math.ceil(baseSalary / businessDays * absenceDays)
      : 0;

    let overtimePay = 0;
    let regularOvertimePay = 0;
    let excessOvertimePay = 0;
    let lateNightPay = 0;
    let holidayPay = 0;
    let overtimeWarnings: string[] | null = null;

    if (!isExecutive) {
      const hourlyRate = contractHours > 0 ? baseSalary / contractHours : 0;
      const otBreakdown = calculateOvertimeBreakdown(attendances as any);
      const regularOtHours = Math.max(0, otBreakdown.regularOtMinutes / 60 - fixedOvertime);
      regularOvertimePay = Math.round(hourlyRate * 1.25 * regularOtHours);
      excessOvertimePay = Math.round(hourlyRate * 1.50 * otBreakdown.excessOtMinutes / 60);
      lateNightPay = Math.round(hourlyRate * 0.25 * otBreakdown.lateNightMinutes / 60);
      holidayPay = Math.round(hourlyRate * 1.35 * otBreakdown.holidayMinutes / 60);
      overtimePay = regularOvertimePay + excessOvertimePay + lateNightPay + holidayPay;

      const monthlyOtMinutes = otBreakdown.regularOtMinutes + otBreakdown.excessOtMinutes
        + otBreakdown.lateNightMinutes + otBreakdown.holidayMinutes;
      const monthlyOtHours = monthlyOtMinutes / 60;
      const yearlyOtHours = (yearlyOtMinutes + monthlyOtMinutes) / 60;
      const limitCheck = checkOvertimeLimits(monthlyOtHours, yearlyOtHours);
      if (limitCheck.warnings.length > 0) {
        overtimeWarnings = limitCheck.warnings;
      }
    }

    const approvedExpenses = await this.db.expenseItem.findMany({
      where: {
        expenseRequest: { employeeId: emp.id, targetMonth, status: 'approved' },
      },
    });
    const commuteAllowance = approvedExpenses.reduce((s, it) => s + (it.amount || 0), 0);

    const grossSalary = baseSalary + fixedOvertimePay - absenceDeduction + overtimePay + commuteAllowance;

    let healthInsurance: number;
    let pension: number;
    if (emp.rateHealthInsurance === null || emp.rateHealthInsurance === undefined) {
      const monthlyRemuneration = baseSalary + fixedOvertimePay;
      const gradeInfo = findGrade(monthlyRemuneration);
      healthInsurance = calcHealthInsurance(gradeInfo.standardAmount);
      pension = calcPension(gradeInfo.standardAmount);
    } else {
      healthInsurance = Math.round(grossSalary * Number(emp.rateHealthInsurance));
      const pensionRate = emp.rateEmployeePension !== null && emp.rateEmployeePension !== undefined
        ? Number(emp.rateEmployeePension) : Number(rateMaster.employeePension);
      pension = Math.round(grossSalary * pensionRate);
    }

    const empInsRate = emp.rateEmploymentInsurance !== null && emp.rateEmploymentInsurance !== undefined
      ? Number(emp.rateEmploymentInsurance)
      : Number(rateMaster.employmentInsurance);
    const employmentInsurance = Math.round(grossSalary * empInsRate);

    let incomeTax: number;
    if (emp.rateIncomeTax === null || emp.rateIncomeTax === undefined) {
      const taxableIncome = grossSalary - healthInsurance - pension - employmentInsurance;
      incomeTax = calcWithholdingTax(taxableIncome, depCount);
    } else {
      incomeTax = Math.round(grossSalary * Number(emp.rateIncomeTax));
    }

    const residentTaxFixed = emp.rateResidentTaxFixed !== null && emp.rateResidentTaxFixed !== undefined
      ? emp.rateResidentTaxFixed
      : rateMaster.residentTaxFixed;
    const residentTax = residentTaxFixed;

    const totalDeductions = healthInsurance + pension + employmentInsurance + incomeTax + residentTax;
    const netSalary = grossSalary - totalDeductions;

    const monthlyRem = baseSalary + fixedOvertimePay;
    const gradeResult = findGrade(monthlyRem);

    await this.db.payroll.upsert({
      where: { employeeId_targetMonth: { employeeId: emp.id, targetMonth } },
      create: {
        employeeId: emp.id, targetMonth, baseSalary, fixedOvertimePay,
        fixedOvertimeHours: fixedOvertime,
        absenceDeduction, overtimePay,
        regularOvertimePay, excessOvertimePay, lateNightPay, holidayPay,
        commuteAllowance, otherAllowance: 0, grossSalary,
        standardRemunerationGrade: gradeResult.grade,
        standardMonthlyRemuneration: gradeResult.standardAmount,
        healthInsurance, pension, employmentInsurance, incomeTax, residentTax,
        totalDeductions, netSalary,
        businessDays, actualWorkDays,
        overtimeWarnings: overtimeWarnings ? overtimeWarnings : undefined,
        status: 'draft',
      },
      update: {
        baseSalary, fixedOvertimePay,
        fixedOvertimeHours: fixedOvertime,
        absenceDeduction, overtimePay,
        regularOvertimePay, excessOvertimePay, lateNightPay, holidayPay,
        commuteAllowance, grossSalary,
        standardRemunerationGrade: gradeResult.grade,
        standardMonthlyRemuneration: gradeResult.standardAmount,
        healthInsurance, pension, employmentInsurance, incomeTax,
        residentTax, totalDeductions, netSalary,
        businessDays, actualWorkDays,
        overtimeWarnings: overtimeWarnings ? overtimeWarnings : undefined,
      },
    });

    this.logger.log(`Payroll auto-calculated for ${emp.id} ${targetMonth}: gross=${grossSalary}, net=${netSalary}`);
    return { calculated: true };
  }

  /**
   * 勤怠確定イベントハンドラ — 個別給与計算を自動実行
   */
  @OnEvent('attendance.confirmed')
  async handleAttendanceConfirmed(event: AttendanceConfirmedEvent) {
    const [year, month] = event.yearMonth.split('-').map(Number);
    try {
      const result = await this.calculateForEmployee(event.employeeId, year, month);
      this.logger.log(
        `Auto-calc payroll for ${event.employeeId} ${event.yearMonth}: ${result.calculated ? 'done' : 'skipped'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to auto-calc payroll for ${event.employeeId} ${event.yearMonth}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 個別の給与レコードを確定する（管理者用）
   * 確定時に社員へ通知を送信する。
   */
  async confirmPayrollRecord(payrollId: string, actorUserId?: string) {
    const payroll = await this.db.payroll.findUnique({
      where: { id: payrollId },
      include: { employee: { select: { id: true, user: { select: { role: true } } } } },
    });
    if (!payroll) throw new NotFoundException('給与レコードが見つかりません');
    if (payroll.status === 'confirmed') {
      throw new BadRequestException('既に確定済みです');
    }
    if (payroll.grossSalary === null) {
      throw new BadRequestException('給与計算が実行されていません');
    }

    await this.db.payroll.update({
      where: { id: payrollId },
      data: { status: 'confirmed' },
    });

    // 社員へ通知
    const [year, month] = payroll.targetMonth.split('-');
    await this.notificationsService.create({
      employeeId: payroll.employeeId,
      title: `${Number(year)}年${Number(month)}月の給与が確定しました`,
      body: `${Number(year)}年${Number(month)}月分の給与明細が確認できます。`,
      category: 'payroll',
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'payroll.confirm',
      targetTable: 'payrolls',
      targetId: payrollId,
      newValue: { targetMonth: payroll.targetMonth },
    });

    this.logger.log(`Payroll confirmed: ${payrollId}`);
    return { confirmed: true };
  }

  /* ==============================================================
   * J6: 給与レコードの直接編集 + 編集履歴
   * ============================================================== */

  /**
   * 特定の給与レコードを直接編集。差分を PayrollEditHistory に記録し、
   * 総支給/控除/手取りを再計算する。status='confirmed' は編集不可。
   */
  async updatePayrollRecord(
    payrollId: string,
    data: {
      baseSalary?: number;
      fixedOvertimePay?: number;
      absenceDeduction?: number;
      overtimePay?: number;
      commuteAllowance?: number;
      otherAllowance?: number;
      healthInsurance?: number;
      pension?: number;
      employmentInsurance?: number;
      incomeTax?: number;
      residentTax?: number;
      reason?: string;
    },
    editedBy?: string,
    actorUserId?: string,
    viewer?: { role: string; employeeId: string },
  ) {
    const payroll = await this.db.payroll.findUnique({
      where: { id: payrollId },
      include: { employee: { select: { id: true, user: { select: { role: true } } } } },
    });
    if (!payroll) throw new NotFoundException('給与レコードが見つかりません');
    if (payroll.status === 'confirmed') {
      throw new BadRequestException('確定済みの給与は編集できません');
    }

    // E: 階層可視性 — manager は admin / 他 manager の給与を編集できない
    if (viewer && viewer.role === 'manager') {
      const targetRole = payroll.employee?.user?.role ?? 'employee';
      const isSelf = payroll.employee?.id === viewer.employeeId;
      if (!isSelf && (targetRole === 'admin' || targetRole === 'manager')) {
        throw new ForbiddenException('この社員の給与を編集する権限がありません');
      }
    }

    // 編集可能フィールド
    const editableFields: (keyof typeof data)[] = [
      'baseSalary', 'fixedOvertimePay', 'absenceDeduction',
      'overtimePay', 'commuteAllowance', 'otherAllowance',
      'healthInsurance', 'pension', 'employmentInsurance', 'incomeTax', 'residentTax',
    ];

    // 差分検出
    const changes: Array<{ field: string; oldVal: number; newVal: number }> = [];
    for (const f of editableFields) {
      if (data[f] === undefined) continue;
      const oldVal = (payroll as any)[f] ?? 0;
      const newVal = data[f] as number;
      if (oldVal !== newVal) {
        changes.push({ field: f, oldVal, newVal });
      }
    }

    if (changes.length === 0) {
      return { updated: false, payroll };
    }

    // 新しい値を組み立て
    const newBase = data.baseSalary ?? payroll.baseSalary;
    const newFixedOt = data.fixedOvertimePay ?? payroll.fixedOvertimePay;
    const newAbsDed = data.absenceDeduction ?? payroll.absenceDeduction;
    const newOt = data.overtimePay ?? payroll.overtimePay;
    const newCommute = data.commuteAllowance ?? payroll.commuteAllowance;
    const newOther = data.otherAllowance ?? payroll.otherAllowance;
    const grossSalary = newBase + newFixedOt - newAbsDed + newOt + newCommute + newOther;

    const newHealth = data.healthInsurance ?? payroll.healthInsurance;
    const newPension = data.pension ?? payroll.pension;
    const newEmpIns = data.employmentInsurance ?? payroll.employmentInsurance;
    const newIncome = data.incomeTax ?? payroll.incomeTax;
    const newResident = data.residentTax ?? payroll.residentTax;
    const totalDeductions = newHealth + newPension + newEmpIns + newIncome + newResident;
    const netSalary = grossSalary - totalDeductions;

    // トランザクションで更新 + 履歴追加
    const updated = await this.db.$transaction(async (tx) => {
      const up = await tx.payroll.update({
        where: { id: payrollId },
        data: {
          baseSalary: newBase,
          overtimePay: newOt,
          commuteAllowance: newCommute,
          otherAllowance: newOther,
          grossSalary,
          healthInsurance: newHealth,
          pension: newPension,
          employmentInsurance: newEmpIns,
          incomeTax: newIncome,
          residentTax: newResident,
          totalDeductions,
          netSalary,
        },
      });
      for (const ch of changes) {
        await tx.payrollEditHistory.create({
          data: {
            payrollId,
            editedBy,
            fieldName: ch.field,
            oldValue: ch.oldVal,
            newValue: ch.newVal,
            reason: data.reason,
          },
        });
      }
      return up;
    });

    this.logger.log(`Payroll ${payrollId} edited: ${changes.length} fields changed by ${editedBy ?? 'unknown'}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'payroll.edit',
      targetTable: 'payrolls',
      targetId: payrollId,
      oldValue: changes.reduce((acc, ch) => ({ ...acc, [ch.field]: ch.oldVal }), {}),
      newValue: changes.reduce((acc, ch) => ({ ...acc, [ch.field]: ch.newVal }), {}),
    });

    return { updated: true, payroll: updated, changedFields: changes.length };
  }

  /**
   * 給与レコードの編集履歴を取得
   */
  async getPayrollEditHistory(payrollId: string) {
    const history = await this.db.payrollEditHistory.findMany({
      where: { payrollId },
      orderBy: { createdAt: 'desc' },
    });

    // 編集者名を付与
    const editorIds = Array.from(new Set(history.map(h => h.editedBy).filter((v): v is string => !!v)));
    const editors = editorIds.length > 0
      ? await this.db.employee.findMany({
          where: { id: { in: editorIds } },
          select: { id: true, lastName: true, firstName: true },
        })
      : [];
    const editorMap = new Map(editors.map(e => [e.id, `${e.lastName} ${e.firstName}`]));

    return history.map(h => ({
      ...h,
      editorName: h.editedBy ? (editorMap.get(h.editedBy) || '不明') : 'システム',
    }));
  }

  /* ==============================================================
   * J1: 料率マスタ CRUD（管理者用）
   * ============================================================== */

  /**
   * 料率マスタを取得。存在しなければデフォルト値で作成して返す。
   */
  async getRateMaster() {
    const master = await this.db.rateMaster.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      healthInsurance: Number(master.healthInsurance),
      employeePension: Number(master.employeePension),
      employmentInsurance: Number(master.employmentInsurance),
      incomeTax: Number(master.incomeTax),
      residentTaxFixed: master.residentTaxFixed,
      updatedAt: master.updatedAt,
      updatedBy: master.updatedBy,
    };
  }

  /**
   * 料率マスタを更新（管理者用）
   */
  async updateRateMaster(
    data: {
      healthInsurance?: number;
      employeePension?: number;
      employmentInsurance?: number;
      incomeTax?: number;
      residentTaxFixed?: number;
    },
    updatedBy?: string,
  ) {
    const update: any = {};
    if (data.healthInsurance !== undefined) update.healthInsurance = data.healthInsurance;
    if (data.employeePension !== undefined) update.employeePension = data.employeePension;
    if (data.employmentInsurance !== undefined) update.employmentInsurance = data.employmentInsurance;
    if (data.incomeTax !== undefined) update.incomeTax = data.incomeTax;
    if (data.residentTaxFixed !== undefined) update.residentTaxFixed = data.residentTaxFixed;
    if (updatedBy) update.updatedBy = updatedBy;

    const updated = await this.db.rateMaster.upsert({
      where: { id: 'default' },
      update,
      create: { id: 'default', ...update },
    });
    return {
      healthInsurance: Number(updated.healthInsurance),
      employeePension: Number(updated.employeePension),
      employmentInsurance: Number(updated.employmentInsurance),
      incomeTax: Number(updated.incomeTax),
      residentTaxFixed: updated.residentTaxFixed,
      updatedAt: updated.updatedAt,
    };
  }
}
