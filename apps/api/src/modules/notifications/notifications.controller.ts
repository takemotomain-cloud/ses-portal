import { Controller, Get, Post, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('通知')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
