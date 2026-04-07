import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AutoNotificationService } from './auto-notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('自動通知')
@ApiBearerAuth()
@Controller('auto-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AutoNotificationController {
  constructor(private readonly autoNotificationService: AutoNotificationService) {}

  @Get()
  @ApiOperation({ summary: '自動通知ルール一覧' })
  async findAll() {
    return this.autoNotificationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '自動通知ルール詳細' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.autoNotificationService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '自動通知ルール作成' })
  async create(@Body() body: {
    name: string;
    triggerType: 'cron' | 'event';
    triggerConfig?: Record<string, any>;
    targetType: 'all' | 'department' | 'area' | 'individual' | 'affected';
    titleTemplate: string;
    bodyTemplate: string;
    isEnabled?: boolean;
  }) {
    return this.autoNotificationService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '自動通知ルール更新' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      name?: string;
      triggerType?: 'cron' | 'event';
      triggerConfig?: Record<string, any>;
      targetType?: 'all' | 'department' | 'area' | 'individual' | 'affected';
      titleTemplate?: string;
      bodyTemplate?: string;
      isEnabled?: boolean;
    },
  ) {
    return this.autoNotificationService.update(id, body);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: '自動通知ルール有効/無効切替' })
  async toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isEnabled: boolean },
  ) {
    return this.autoNotificationService.toggleEnabled(id, body.isEnabled);
  }

  @Delete(':id')
  @ApiOperation({ summary: '自動通知ルール削除' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.autoNotificationService.remove(id);
    return { message: '削除しました' };
  }
}
