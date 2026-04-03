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

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private readonly db: DatabaseService) {}

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
   */
  async getMonthlyPayroll(year: number, month: number) {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    return this.db.payroll.findMany({
      where: { targetMonth },
      include: {
        employee: { select: { employeeCode: true, lastName: true, firstName: true } },
      },
      orderBy: { employee: { employeeCode: 'asc' } },
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

    const employees = await this.db.employee.findMany({
      where: { status: 'active', deletedAt: null },
      include: {
        assignments: { where: { status: 'active', deletedAt: null }, take: 1 },
      },
    });

    let processedCount = 0;

    for (const emp of employees) {
      const assignment = emp.assignments[0];
      const rewardRate = emp.rewardRate ? Number(emp.rewardRate) / 100 : 0.7;

      // 基本給 = 契約単価 × 還元率（アサインがない場合はemployeesのbase_salary）
      const baseSalary = assignment
        ? Math.round(assignment.contractPrice * rewardRate)
        : (emp.baseSalary || 0);

      // 残業手当（勤怠データから計算。簡易版: 時給 × 残業時間 × 1.25）
      const hourlyRate = Math.round(baseSalary / 160); // 月160時間想定
      const attendances = await this.db.attendance.findMany({
        where: {
          employeeId: emp.id,
          workDate: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0),
          },
        },
      });
      const totalOT = attendances.reduce((s, a) => s + (a.overtimeMinutes || 0), 0);
      const overtimePay = Math.round(hourlyRate * (totalOT / 60) * 1.25);

      const commuteAllowance = 12000; // 仮固定。経費精算データから取得予定
      const grossSalary = baseSalary + overtimePay + commuteAllowance;

      // 控除（簡易計算。本番では標準報酬月額テーブルを参照）
      const healthInsurance = Math.round(grossSalary * 0.05);
      const pension = Math.round(grossSalary * 0.0915);
      const employmentInsurance = Math.round(grossSalary * 0.006);
      const incomeTax = Math.round(grossSalary * 0.033);
      const residentTax = 18000; // 仮固定
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
  async confirmPayroll(year: number, month: number) {
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    const result = await this.db.payroll.updateMany({
      where: { targetMonth, status: 'draft' },
      data: { status: 'confirmed' },
    });
    this.logger.log(`Payroll confirmed for ${targetMonth}: ${result.count} records`);
    return { confirmedCount: result.count };
  }
}
