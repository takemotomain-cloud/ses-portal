import { Controller, Get, Post, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('通知')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /* --- 管理者用 一括送信（固定パスを先に配置） --- */

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'お知らせ一括送信（管理者）' })
  async send(@Body() body: {
    title: string;
    body: string;
    targetType: 'all' | 'department' | 'area' | 'individual';
    targetIds?: string[];
    targetArea?: string;
  }) {
    return this.notificationsService.sendBulk(body);
  }

  @Get('sent')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '送信済みお知らせ一覧（管理者）' })
  async getSentNotifications() {
    return this.notificationsService.getSentNotifications();
  }

  @Get('targets')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '送信先の選択肢を取得（管理者）' })
  async getTargets() {
    return this.notificationsService.getTargetOptions();
  }

  /* --- 社員用 --- */

  @Get()
  @ApiOperation({ summary: '自分の通知一覧' })
  async getMyNotifications(@CurrentUser() user: RequestUser, @Query('limit') limit?: number) {
    return this.notificationsService.getMyNotifications(user.employeeId, limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '未読件数' })
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    const count = await this.notificationsService.getUnreadCount(user.employeeId);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: '通知を既読にする' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.notificationsService.markAsRead(id, user.employeeId);
    return { message: '既読にしました' };
  }

  @Post('read-all')
  @ApiOperation({ summary: '全件既読にする' })
  async markAllAsRead(@CurrentUser() user: RequestUser) {
    await this.notificationsService.markAllAsRead(user.employeeId);
    return { message: 'すべて既読にしました' };
  }
}
