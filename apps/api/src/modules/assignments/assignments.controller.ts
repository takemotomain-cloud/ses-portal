/**
 * Assignments Controller
 *
 * エンドポイント:
 *   POST /api/assignments          — 新規アサイン登録（admin/sales）
 *   GET  /api/assignments          — アサイン一覧（admin/sales）
 *   GET  /api/assignments/current  — 現在の稼働先
 *   GET  /api/assignments/history  — 稼働ヒストリー
 */

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('稼働情報')
@ApiBearerAuth()
@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * 新規アサイン登録（admin/salesのみ）
   */
  @Post()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '新規アサイン登録' })
  async create(
    @Body()
    body: {
      employeeId: string;
      clientId: string;
      projectName: string;
      contractPrice: number;
      settlementLower: number;
      settlementUpper: number;
      overtimeRate?: number | null;
      deductionRate?: number | null;
      workLocation?: string;
      area?: string;
      defaultStartTime?: string;
      attendanceFormat?: string;
      clientAttendanceRequired?: boolean;
      projectId?: string;
      startDate: string;
      endDate?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.create(body, user.tenantId);
  }

  /**
   * アサイン一覧（admin/salesのみ）
   */
  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'アサイン一覧' })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.assignmentsService.findAll({ page, limit, status, year, month, tenantId: user.tenantId });
  }

  /**
   * アサイン更新（admin/salesのみ）
   *
   * M3: contractPrice / settlementLower / settlementUpper の変更があった場合、
   * 自動的に改定履歴（AssignmentRateHistory）に1レコード追加される。
   * 履歴用に rateChangeReason / rateChangeEffectiveFrom を body で受け付ける。
   */
  @Patch(':id')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'アサイン更新' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      projectName?: string;
      contractPrice?: number;
      settlementLower?: number;
      settlementUpper?: number;
      overtimeRate?: number | null;
      deductionRate?: number | null;
      workLocation?: string;
      area?: string;
      defaultStartTime?: string;
      attendanceFormat?: string;
      clientAttendanceRequired?: boolean;
      projectId?: string;
      startDate?: string;
      endDate?: string;
      rateChangeReason?: string;
      rateChangeEffectiveFrom?: string;
    },
  ) {
    return this.assignmentsService.update(id, {
      ...body,
      rateChangedBy: user.employeeId,
    }, user.tenantId);
  }

  /**
   * アサイン単価改定履歴を取得（M3）
   */
  @Get(':id/rate-history')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '単価改定履歴' })
  async getRateHistory(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignmentsService.getRateHistory(id, user.tenantId);
  }

  /**
   * 稼働終了（admin/salesのみ）
   */
  @Post(':id/end')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '稼働終了' })
  async endAssignment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body?: { mode?: string; endDate?: string; endReason?: string },
  ) {
    return this.assignmentsService.endAssignment(id, user.tenantId, body);
  }

  @Patch(':id/extend')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '契約延長' })
  async extendAssignment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { endDate: string },
  ) {
    return this.assignmentsService.extendAssignment(id, user.tenantId, body.endDate);
  }

  @Get('current')
  @ApiOperation({ summary: '現在の稼働先を取得' })
  async getCurrent(@CurrentUser() user: RequestUser) {
    return this.assignmentsService.getCurrentAssignment(user.employeeId, user.tenantId);
  }

  @Get('history')
  @ApiOperation({ summary: '稼働ヒストリーを取得' })
  async getHistory(@CurrentUser() user: RequestUser) {
    return this.assignmentsService.getHistory(user.employeeId, user.tenantId);
  }
}
