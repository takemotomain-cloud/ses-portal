/**
 * Settings Controller
 *
 * 部署・役職管理のREST APIエンドポイント。
 *
 * エンドポイント一覧:
 *   GET    /api/settings/departments       — 部署一覧
 *   POST   /api/settings/departments       — 部署新規作成
 *   GET    /api/settings/positions         — 役職一覧
 *   POST   /api/settings/positions         — 役職新規作成
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('設定')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly googleDrive: GoogleDriveService,
  ) {}

  /* ========== 部署 ========== */

  @Get('departments')
  @Roles('admin')
  @ApiOperation({ summary: '部署一覧' })
  async findAllDepartments(@CurrentUser() user: RequestUser) {
    return this.settingsService.findAllDepartments(user.tenantId);
  }

  @Post('departments')
  @Roles('admin')
  @ApiOperation({ summary: '部署新規作成' })
  async createDepartment(
    @Body() body: { name: string; code: string; parentId?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.createDepartment(body, user.tenantId);
  }

  /* ========== 役職 ========== */

  @Get('positions')
  @Roles('admin')
  @ApiOperation({ summary: '役職一覧' })
  async findAllPositions(@CurrentUser() user: RequestUser) {
    return this.settingsService.findAllPositions(user.tenantId);
  }

  @Post('positions')
  @Roles('admin')
  @ApiOperation({ summary: '役職新規作成' })
  async createPosition(
    @Body() body: { name: string; rank: number; hasApproval?: boolean },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.createPosition(body, user.tenantId);
  }

  /* ========== Google Drive 連携 ========== */

  @Get('google-drive/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive連携状態' })
  async googleDriveStatus(@CurrentUser() user: RequestUser) {
    return this.googleDrive.getStatus(user.tenantId);
  }

  @Post('google-drive/root-folder')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive保存ルートフォルダを設定' })
  async googleDriveRootFolder(
    @Body() body: { rootFolderPath: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.googleDrive.setRootFolderPath(user.tenantId, body.rootFolderPath);
  }

  @Get('google-drive/connect')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive OAuth開始（認証URLを返す）' })
  async googleDriveConnect(@CurrentUser() user: RequestUser) {
    const url = this.googleDrive.getAuthorizationUrl(user.tenantId);
    return { url };
  }

  @Post('google-drive/disconnect')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive連携解除' })
  async googleDriveDisconnect(@CurrentUser() user: RequestUser) {
    await this.googleDrive.disconnect(user.tenantId);
    return { success: true };
  }
}

/**
 * Google Drive OAuthコールバック用コントローラー（認証不要）
 * Googleからのリダイレクトで呼ばれるためJWTガードを付けない。
 */
@Controller('settings')
export class GoogleDriveCallbackController {
  constructor(private readonly googleDrive: GoogleDriveService) {}

  @Get('google-drive/callback')
  @ApiOperation({ summary: 'Google Drive OAuthコールバック' })
  async googleDriveCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { subdomain } = await this.googleDrive.handleCallback(code, state);
    const appBaseUrl =
      process.env.APP_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3000';
    res.redirect(`${appBaseUrl}/t/${subdomain}/admin/settings?tab=integrations&connected=1`);
  }
}
