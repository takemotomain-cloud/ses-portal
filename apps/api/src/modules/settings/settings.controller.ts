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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('設定')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}
