/**
 * Notices Controller
 *
 * 通知書 (内定通知書 / 労働条件通知書 有期・無期) の発行 API。
 * 発行時に PDF 生成 → Drive 保存 → DocumentIssuance に履歴を残す。
 */

import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoticeWorkflowUpdateInput, NoticesService } from './notices.service';
import { OfferData, LaborFixedData, LaborOpenData } from './notice-pdf.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('通知書')
@ApiBearerAuth()
@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Post('offer/:employeeId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '採用内定通知書を発行（PDF生成 + Drive保存）' })
  async issueOffer(
    @Param('employeeId') employeeId: string,
    @Body() body: OfferData,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notices.issueOffer(employeeId, body, user.userId);
  }

  @Post('labor-fixed/:employeeId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '労働条件通知書（有期）を発行（PDF生成 + Drive保存）' })
  async issueLaborFixed(
    @Param('employeeId') employeeId: string,
    @Body() body: LaborFixedData,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notices.issueLaborFixed(employeeId, body, user.userId);
  }

  @Post('labor-open/:employeeId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '労働条件通知書（無期）を発行（PDF生成 + Drive保存）' })
  async issueLaborOpen(
    @Param('employeeId') employeeId: string,
    @Body() body: LaborOpenData,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notices.issueLaborOpen(employeeId, body, user.userId);
  }

  @Get('history/:employeeId')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '社員の通知書発行履歴を取得' })
  async listHistory(@Param('employeeId') employeeId: string) {
    return this.notices.listByEmployee(employeeId);
  }

  @Patch(':issuanceId/workflow')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '通知書の送付・承諾ステータスを更新' })
  async updateWorkflow(
    @Param('issuanceId') issuanceId: string,
    @Body() body: NoticeWorkflowUpdateInput,
  ) {
    return this.notices.updateWorkflow(issuanceId, body);
  }
}
