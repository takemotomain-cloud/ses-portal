/**
 * Payroll Controller
 *
 * GET  /api/salary/:year/:month        — 自分の給与明細（社員用）
 * GET  /api/payroll/:year/:month       — 全社員の給与一覧（管理者用）
 * POST /api/payroll/:year/:month/calc  — 給与計算実行（管理者用）
 * POST /api/payroll/:year/:month/confirm — 給与確定（管理者用）
 */

import { Controller, Get, Post, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
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

  @Get('payroll/:year/:month')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '全社員の月次給与一覧（管理者用）' })
  async getMonthlyPayroll(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.getMonthlyPayroll(year, month);
  }

  @Post('payroll/:year/:month/calc')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '給与計算を実行（管理者用）' })
  async calculate(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.calculateMonthly(year, month);
  }

  @Post('payroll/:year/:month/confirm')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '給与を確定する（管理者用）' })
  async confirm(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.payrollService.confirmPayroll(year, month);
  }
}
