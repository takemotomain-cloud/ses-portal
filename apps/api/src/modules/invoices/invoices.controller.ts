import { Controller, Get, Post, Put, Patch, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('請求書')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('billable')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '請求発行可能一覧' })
  async getBillable(@Query('month') month: string) {
    return this.invoicesService.getBillableEmployees(month);
  }

  @Post('generate')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '勤怠ベース請求書発行' })
  async generate(@Body() body: {
    clientId: string;
    targetMonth: string;
    employeeIds: string[];
    invoiceDate?: string;
    dueDate?: string;
    notes?: string;
  }) {
    return this.invoicesService.generateFromAttendance(body);
  }

  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '請求書一覧' })
  async findAll(@Query('month') month?: string) {
    return this.invoicesService.findAll(month);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '請求書詳細' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '請求書作成' })
  async create(@Body() body: any) {
    return this.invoicesService.create(body);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '請求書更新' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.invoicesService.update(id, body);
  }

  @Patch(':id/status')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '請求書ステータス更新' })
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    return this.invoicesService.updateStatus(id, status);
  }
}
