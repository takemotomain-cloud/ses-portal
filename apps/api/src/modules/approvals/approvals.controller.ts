import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';

@ApiTags('承認待ち')
@ApiBearerAuth()
@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('sidebar-summary')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '管理サイドバー用の件数を取得' })
  async getSidebarSummary(@CurrentUser() user: RequestUser) {
    return this.approvalsService.getSidebarSummary(user.employeeId, user.tenantId);
  }

  @Get('history')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '処理済み承認履歴を取得' })
  async getHistory(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.approvalsService.getProcessedHistory(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 100,
    );
  }
}
