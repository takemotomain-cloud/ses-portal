/**
 * Assignments Controller
 *
 * エンドポイント:
 *   GET /api/assignments/current  — 現在の稼働先
 *   GET /api/assignments/history  — 稼働ヒストリー
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('稼働情報')
@ApiBearerAuth()
@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get('current')
  @ApiOperation({ summary: '現在の稼働先を取得' })
  async getCurrent(@CurrentUser() user: RequestUser) {
    return this.assignmentsService.getCurrentAssignment(user.employeeId);
  }

  @Get('history')
  @ApiOperation({ summary: '稼働ヒストリーを取得' })
  async getHistory(@CurrentUser() user: RequestUser) {
    return this.assignmentsService.getHistory(user.employeeId);
  }
}
