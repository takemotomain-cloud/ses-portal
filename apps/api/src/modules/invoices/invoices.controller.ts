import { Controller, Get, Post, Put, Patch, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('請求書')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('billable')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '請求発行可能一覧' })
  async getBillable(@Query('month') month: string, @CurrentUser() user: RequestUser) {
    return this.invoicesService.getBillableEmployees(month, user.tenantId);
  }

  @Post('generate')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '勤怠ベース請求書発行' })
  async generateFromAttendance(@Body() body: {
    clientId: string;
    targetMonth: string;
    employeeIds: string[];
    invoiceDate?: string;
    dueDate?: string;
    notes?: string;
  }, @CurrentUser() user: RequestUser) {
    return this.invoicesService.generateFromAttendance(body, user.tenantId);
  }

  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '請求書一覧' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.invoicesService.findAll(user.tenantId);
  }

  @Get('monthly')
  @ApiOperation({ summary: '対象月の請求書一覧' })
  async findByTargetMonth(
    @Query('targetMonth') targetMonth: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.findByTargetMonth(targetMonth, user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: '請求書詳細取得' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invoicesService.findOne(id, user.tenantId);
  }

  @Post('draft')
  @ApiOperation({ summary: '手動で請求書下書き作成' })
  async createDraft(@Body() body: any, @CurrentUser() user: RequestUser) {
    return this.invoicesService.createDraft(body.clientId, body.targetMonth, user.tenantId);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '請求書更新' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @CurrentUser() user: RequestUser) {
    return this.invoicesService.update(id, body, user.tenantId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'ステータス更新' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: RequestUser) {
    return this.invoicesService.updateStatus(id, status, user.tenantId);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'メール送信' })
  async sendByEmail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invoicesService.sendByEmail(id, user.tenantId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'PDFダウンロード（将来的にバッファを返す）' })
  async downloadPdf(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invoicesService.findOne(id, user.tenantId);
  }
}
