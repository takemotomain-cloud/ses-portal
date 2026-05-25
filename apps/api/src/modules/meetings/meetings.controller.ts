/**
 * Meetings Controller
 *
 * 面談記録のREST APIエンドポイント。
 *
 * エンドポイント一覧:
 *   POST   /api/employees/:employeeId/meetings  — 面談記録を追加
 *   GET    /api/employees/:employeeId/meetings   — 社員の面談記録一覧
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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('面談記録')
@ApiBearerAuth()
@Controller('employees/:employeeId/meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * 面談記録を追加
   */
  @Post()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '面談記録を追加' })
  async create(
    @CurrentUser() user: RequestUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() body: { date: string; interviewer: string; content: string; videoUrl?: string },
  ) {
    return this.meetingsService.create(user.tenantId, employeeId, body);
  }

  /**
   * 社員の面談記録一覧を取得
   */
  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '面談記録一覧' })
  async findByEmployee(
    @CurrentUser() user: RequestUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.meetingsService.findByEmployee(user.tenantId, employeeId);
  }
}
