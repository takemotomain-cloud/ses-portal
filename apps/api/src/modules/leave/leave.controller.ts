/**
 * Leave Controller — 有給休暇 REST API
 *
 * エンドポイント:
 *   GET    /api/leave/balance        — 残日数取得（社員用）
 *   POST   /api/leave/request        — 有給申請（社員用）
 *   GET    /api/leave/pending        — 承認待ち一覧（管理者用）
 *   POST   /api/leave/:id/approve    — 承認（管理者用）
 *   POST   /api/leave/:id/reject     — 却下（管理者用）
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('有給休暇')
@ApiBearerAuth()
@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('balance')
  @ApiOperation({ summary: '有給残日数を取得' })
  async getBalance(@CurrentUser() user: RequestUser) {
    return this.leaveService.getBalance(user.employeeId, user.tenantId);
  }

  @Post('request')
  @ApiOperation({ summary: '有給申請' })
  async createRequest(
    @CurrentUser() user: RequestUser,
    @Body() body: { leaveType: string; startDate: string; endDate: string; days: number; reason?: string },
  ) {
    return this.leaveService.createRequest(user.employeeId, body, user.tenantId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '承認待ち有給申請一覧（管理者用）' })
  async getPending(@CurrentUser() user: RequestUser) {
    return this.leaveService.getPendingRequests(user.tenantId);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '有給申請を承認' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.leaveService.approveRequest(id, user.employeeId, user.tenantId);
    return { message: '承認しました' };
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '有給申請を却下' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
  ) {
    await this.leaveService.rejectRequest(id, user.employeeId, user.tenantId, reason);
    return { message: '却下しました' };
  }
}
