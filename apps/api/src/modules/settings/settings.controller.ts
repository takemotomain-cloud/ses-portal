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
  async findAllDepartments() {
    return this.settingsService.findAllDepartments();
  }

  @Post('departments')
  @Roles('admin')
  @ApiOperation({ summary: '部署新規作成' })
  async createDepartment(
    @Body() body: { name: string; code: string; parentId?: string },
  ) {
    return this.settingsService.createDepartment(body);
  }

  /* ========== 役職 ========== */

  @Get('positions')
  @Roles('admin')
  @ApiOperation({ summary: '役職一覧' })
  async findAllPositions() {
    return this.settingsService.findAllPositions();
  }

  @Post('positions')
  @Roles('admin')
  @ApiOperation({ summary: '役職新規作成' })
  async createPosition(
    @Body() body: { name: string; rank: number; hasApproval?: boolean },
  ) {
    return this.settingsService.createPosition(body);
  }

  /* ========== Google Drive 連携 ========== */

  @Get('google-drive/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive連携状態' })
  async googleDriveStatus() {
    return this.googleDrive.getStatus();
  }

  @Get('google-drive/connect')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive OAuth開始（認証URLを返す）' })
  async googleDriveConnect() {
    const url = this.googleDrive.getAuthorizationUrl();
    return { url };
  }

  @Post('google-drive/disconnect')
  @Roles('admin')
  @ApiOperation({ summary: 'Google Drive連携解除' })
  async googleDriveDisconnect() {
    await this.googleDrive.disconnect();
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
  async googleDriveCallback(@Query('code') code: string, @Res() res: Response) {
    await this.googleDrive.handleCallback(code);
    res.redirect('http://localhost:3000/admin/settings?tab=integrations&connected=1');
  }
}
