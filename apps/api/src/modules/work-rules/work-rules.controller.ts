/**
 * Work Rules Controller
 *
 * エンドポイント:
 *   GET  /api/rules/current   — 現行版取得（社員用）
 *   GET  /api/rules/history   — 改定履歴（管理者用）
 *   POST /api/rules/publish   — 新バージョン公開（管理者用）
 */

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WorkRulesService } from './work-rules.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('就業規則')
@ApiBearerAuth()
@Controller('rules')
@UseGuards(JwtAuthGuard)
export class WorkRulesController {
  constructor(private readonly workRulesService: WorkRulesService) {}

  @Get('current')
  @ApiOperation({ summary: '現行版の就業規則を取得' })
  async getCurrent() {
    return this.workRulesService.getCurrent();
  }

  @Get('history')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '改定履歴一覧（管理者用）' })
  async getHistory() {
    return this.workRulesService.getHistory();
  }

  @Post('publish')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '就業規則を公開（管理者用）' })
  async publish(
    @CurrentUser() user: RequestUser,
    @Body() body: { version: string; effectiveDate: string; content: any; memo?: string },
  ) {
    return this.workRulesService.publish({
      ...body,
      publishedBy: user.employeeId,
    });
  }
}
