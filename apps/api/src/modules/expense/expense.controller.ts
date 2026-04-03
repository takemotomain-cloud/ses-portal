/**
 * Expense Controller
 *
 * POST /api/expense/request       — 経費申請（明細付き）
 * GET  /api/expense/my             — 自分の経費申請一覧
 * GET  /api/expense/pending        — 承認待ち一覧（管理者用）
 * POST /api/expense/:id/approve    — 承認
 * POST /api/expense/:id/reject     — 却下
 */

import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('経費精算')
@ApiBearerAuth()
@Controller('expense')
@UseGuards(JwtAuthGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post('request')
  @ApiOperation({ summary: '経費申請（明細付き）' })
  async createRequest(
    @CurrentUser() user: RequestUser,
    @Body() body: { targetMonth: string; items: { expenseDate: string; departure: string; destination: string; amount: number }[] },
  ) {
    return this.expenseService.createRequest(user.employeeId, body);
  }

  @Get('my')
  @ApiOperation({ summary: '自分の経費申請一覧' })
  async getMyRequests(@CurrentUser() user: RequestUser) {
    return this.expenseService.getMyRequests(user.employeeId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '承認待ち経費申請一覧（管理者用）' })
  async getPending() {
    return this.expenseService.getPendingRequests();
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '経費申請を承認' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.expenseService.approve(id, user.employeeId);
    return { message: '承認しました' };
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '経費申請を却下' })
  async reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.expenseService.reject(id, user.employeeId);
    return { message: '却下しました' };
  }
}
