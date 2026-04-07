import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
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

  @Get()
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '請求書一覧' })
  async findAll(@Query('month') month?: string) {
    return this.invoicesService.findAll(month);
  }

  @Get(':id')
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '請求書詳細' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '請求書作成' })
  async create(@Body() body: any) {
    return this.invoicesService.create(body);
  }

  @Patch(':id/status')
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '請求書ステータス更新' })
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string) {
    return this.invoicesService.updateStatus(id, status);
  }
}
