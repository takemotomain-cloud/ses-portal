/**
 * Payroll Controller
 *
 * GET  /api/salary/:year/:month        — 自分の給与明細（社員用）
 * GET  /api/payroll/rate-master        — 料率マスタ取得（管理者用）
 * PATCH /api/payroll/rate-master       — 料率マスタ更新（管理者用）
 * GET  /api/payroll/:year/:month       — 全社員の給与一覧（管理者用）
 * POST /api/payroll/:year/:month/calc  — 給与計算実行（管理者用）
 * POST /api/payroll/:year/:month/confirm — 給与確定（管理者用）
 */

import { Controller, Get, Post, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('給与管理')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('salary/:year/:month')
  @ApiOperation({ summary: '自分の給与明細（社員用）' })
  async getMyPayslip(
    @CurrentUser() user: RequestUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.getMyPayslip(user.employeeId, year, month);
  }

  /* ------------------------------------------------------------------
   * J1: 料率マスタ（/:year/:month の前に定義して route 衝突を避ける）
   * ------------------------------------------------------------------ */

  @Get('payroll/rate-master')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '料率マスタを取得' })
  async getRateMaster() {
    return this.payrollService.getRateMaster();
  }

  @Patch('payroll/rate-master')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '料率マスタを更新' })
  async updateRateMaster(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      healthInsurance?: number;
      employeePension?: number;
      employmentInsurance?: number;
      incomeTax?: number;
      residentTaxFixed?: number;
    },
  ) {
    return this.payrollService.updateRateMaster(body, user.employeeId);
  }

  @Get('payroll/:year/:month')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '全社員の月次給与一覧（管理者用）' })
  async getMonthlyPayroll(
    @CurrentUser() user: RequestUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.getMonthlyPayroll(year, month, {
      role: user.role,
      employeeId: user.employeeId,
    });
  }

  @Get('payroll/:year/:month/closure-status')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '給与計算用: 勤怠確定ステータス取得' })
  async getClosureStatus(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.getClosureStatus(year, month);
  }

  @Post('payroll/:year/:month/calc')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '給与計算を実行（管理者用）' })
  async calculate(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.calculateMonthly(year, month);
  }

  @Post('payroll/:year/:month/confirm')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '給与を確定する（管理者用）' })
  async confirm(
    @CurrentUser() user: RequestUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.confirmPayroll(year, month, user.userId);
  }

  /* ------------------------------------------------------------------
   * J6: 給与レコードの直接編集 + 編集履歴
   * ------------------------------------------------------------------ */

  @Patch('payroll/record/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '給与レコードを直接編集（編集履歴を残す）' })
  async updatePayrollRecord(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
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
  ) {
    return this.payrollService.updatePayrollRecord(id, body, user.employeeId, user.userId, {
      role: user.role,
      employeeId: user.employeeId,
    });
  }

  @Get('payroll/record/:id/history')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '給与レコードの編集履歴を取得' })
  async getPayrollEditHistory(@Param('id') id: string) {
    return this.payrollService.getPayrollEditHistory(id);
  }
}
