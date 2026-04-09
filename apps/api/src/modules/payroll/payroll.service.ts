/**
 * Payroll Service — 給与計算ビジネスロジック
 *
 * SES特有の給与体系:
 *   月額給与 = 契約単価 × 還元率
 *   残業手当 = 精算幅超過分 × 時給
 *
 * ワークフロー: 勤怠締め → 給与計算 → 明細確認 → 確定 → 振込
 *
 * セキュリティ: 給与データは管理者・経理のみ閲覧可能。
 * 社員は自分の給与明細のみ閲覧可能（GET /salary/:year/:month）。
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit-logs/audit.service';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

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
    viewer?: { role: string; employeeId: string },
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

    for (const emp of employees) {
      const assignment = emp.assignments[0];

      // J4: 還元率は社員別設定。空白(null)の場合は還元率計算をスキップし、baseSalary をそのまま使う
      const rewardRateRaw = emp.rewardRate !== null && emp.rewardRate !== undefined
        ? Number(emp.rewardRate)
        : null;
      const rewardRate = rewardRateRaw !== null ? rewardRateRaw / 100 : null;

      // 基本給 = 契約単価 × 還元率（rewardRate が null または アサインがない場合は emp.baseSalary）
      const baseSalary = (assignment && rewardRate !== null)
        ? Math.round(assignment.contractPrice * rewardRate)
        : (emp.baseSalary || 0);

      // J2: 所定労働時間・固定残業時間は社員別設定。未設定時はデフォルト値
      const contractHours = emp.contractHours ?? 168;
      const fixedOvertime = emp.fixedOvertime ?? 20;

      // 残業手当計算式: (基本給 ÷ 所定時間) × 1.25 × max(0, 実残業 - 固定残業)
      // 固定残業時間分は既に基本給に含まれている想定なので、それを超えた分のみ別途支給
      const hourlyRate = contractHours > 0 ? baseSalary / contractHours : 0;
      const attendances = await this.db.attendance.findMany({
        where: {
          employeeId: emp.id,
          workDate: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0),
          },
        },
      });
      const totalOtHours = attendances.reduce((s, a) => s + (a.overtimeMinutes || 0), 0) / 60;
      const extraOtHours = Math.max(0, totalOtHours - fixedOvertime);
      const overtimePay = Math.round(hourlyRate * 1.25 * extraOtHours);

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
      const grossSalary = baseSalary + overtimePay + commuteAllowance;

      // J1: 料率は「社員別上書き（あれば） > RateMaster（デフォルト）」の優先順
      const healthRate = emp.rateHealthInsurance !== null && emp.rateHealthInsurance !== undefined
        ? Number(emp.rateHealthInsurance)
        : Number(rateMaster.healthInsurance);
      const pensionRate = emp.rateEmployeePension !== null && emp.rateEmployeePension !== undefined
        ? Number(emp.rateEmployeePension)
        : Number(rateMaster.employeePension);
      const empInsRate = emp.rateEmploymentInsurance !== null && emp.rateEmploymentInsurance !== undefined
        ? Number(emp.rateEmploymentInsurance)
        : Number(rateMaster.employmentInsurance);
      const incomeTaxRate = emp.rateIncomeTax !== null && emp.rateIncomeTax !== undefined
        ? Number(emp.rateIncomeTax)
        : Number(rateMaster.incomeTax);
      const residentTaxFixed = emp.rateResidentTaxFixed !== null && emp.rateResidentTaxFixed !== undefined
        ? emp.rateResidentTaxFixed
        : rateMaster.residentTaxFixed;

      // 控除（簡易計算。本番では標準報酬月額テーブルを参照）
      const healthInsurance = Math.round(grossSalary * healthRate);
      const pension = Math.round(grossSalary * pensionRate);
      const employmentInsurance = Math.round(grossSalary * empInsRate);
      const incomeTax = Math.round(grossSalary * incomeTaxRate);
      const residentTax = residentTaxFixed;
      const totalDeductions = healthInsurance + pension + employmentInsurance + incomeTax + residentTax;
      const netSalary = grossSalary - totalDeductions;

      // UPSERT
      await this.db.payroll.upsert({
        where: { employeeId_targetMonth: { employeeId: emp.id, targetMonth } },
        create: {
          employeeId: emp.id, targetMonth, baseSalary, overtimePay, commuteAllowance,
          otherAllowance: 0, grossSalary, healthInsurance, pension,
          employmentInsurance, incomeTax, residentTax, totalDeductions, netSalary,
          status: 'draft',
        },
        update: {
          baseSalary, overtimePay, commuteAllowance, grossSalary,
          healthInsurance, pension, employmentInsurance, incomeTax,
          residentTax, totalDeductions, netSalary,
        },
      });

      processedCount++;
    }

    this.logger.log(`Payroll calculated for ${targetMonth}: ${processedCount} employees`);
    return { processedCount, targetMonth };
  }

  /**
   * 給与を確定する（管理者用）
   */
  async confirmPayroll(year: number, month: number, actorUserId?: string) {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    const result = await this.db.payroll.updateMany({
      where: { targetMonth, status: 'draft' },
      data: { status: 'confirmed' },
    });
    this.logger.log(`Payroll confirmed for ${targetMonth}: ${result.count} records`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'payroll.confirm',
      targetTable: 'payrolls',
      newValue: { targetMonth, confirmedCount: result.count },
    });

    return { confirmedCount: result.count };
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
      'baseSalary', 'overtimePay', 'commuteAllowance', 'otherAllowance',
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
    const newOt = data.overtimePay ?? payroll.overtimePay;
    const newCommute = data.commuteAllowance ?? payroll.commuteAllowance;
    const newOther = data.otherAllowance ?? payroll.otherAllowance;
    const grossSalary = newBase + newOt + newCommute + newOther;

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
