import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

/** アップロード先ディレクトリ（プロジェクトルートの uploads/notifications） */
const uploadDir = join(process.cwd(), 'uploads', 'notifications');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

/** アップロード設定 */
const uploadStorage = diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const imageFileFilter = (_req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
    return cb(new Error('画像ファイルのみアップロード可能です'), false);
  }
  cb(null, true);
};

@ApiTags('通知')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /* --- 管理者用 --- */

  @Post('upload-image')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'お知らせ用画像アップロード（管理者）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: uploadStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { imageUrl: null };
    }
    const imageUrl = `/uploads/notifications/${file.filename}`;
    return { imageUrl };
  }

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
    imageUrl?: string;
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
  async getMyNotifications(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: number,
    @Query('audience') audience?: 'admin' | 'employee',
  ) {
    return this.notificationsService.getMyNotifications(user.employeeId, limit, audience);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '未読件数' })
  async getUnreadCount(
    @CurrentUser() user: RequestUser,
    @Query('audience') audience?: 'admin' | 'employee',
  ) {
    const count = await this.notificationsService.getUnreadCount(user.employeeId, audience);
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
  async markAllAsRead(
    @CurrentUser() user: RequestUser,
    @Query('audience') audience?: 'admin' | 'employee',
  ) {
    await this.notificationsService.markAllAsRead(user.employeeId, audience);
    return { message: 'すべて既読にしました' };
  }
}
