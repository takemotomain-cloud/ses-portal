import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FreeeService } from './freee.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('freee連携')
@ApiBearerAuth()
@Controller('freee')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FreeeController {
  constructor(private readonly freeeService: FreeeService) {}

  @Get('journals')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '仕訳一覧' })
  async getJournals(@Query('status') status: string | undefined, @CurrentUser() user: RequestUser) {
    return this.freeeService.getJournals(user.tenantId, status);
  }

  @Get('summary')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '今月のサマリー' })
  async getSummary(@CurrentUser() user: RequestUser) {
    return this.freeeService.getSummary(user.tenantId);
  }

  @Post('journals')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '仕訳作成' })
  async createJournal(@Body() body: any, @CurrentUser() user: RequestUser) {
    return this.freeeService.createJournal(body, user.tenantId);
  }

  @Patch('journals/:id/send')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '仕訳を送信済みに' })
  async markAsSent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.freeeService.markAsSent(id, user.tenantId);
  }

  @Post('sync')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '一括送信' })
  async sendAll(@CurrentUser() user: RequestUser) {
    return this.freeeService.sendAll(user.tenantId);
  }
}
