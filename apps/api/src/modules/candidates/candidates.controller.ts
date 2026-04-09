/**
 * Candidates Controller
 *
 * 採用候補者のREST APIエンドポイント。
 *
 * エンドポイント一覧:
 *   POST   /api/candidates  — 候補者を登録
 *   GET    /api/candidates   — 候補者一覧
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('採用候補者')
@ApiBearerAuth()
@Controller('candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  /**
   * 候補者を登録
   */
  @Post()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '候補者を登録' })
  async create(
    @Body() body: {
      lastName: string;
      firstName: string;
      lastNameKana?: string;
      firstNameKana?: string;
      phone?: string;
      gender?: string;
      residence?: string;
      birthDate?: string;
      education?: string;
      applicationDate: string;
      source: string;
      jobPosting?: string;
      interviewDate?: string;
      interviewTime?: string;
      interviewer?: string;
      confirmStatus?: string;
      desiredLocation?: string;
      desiredMonth?: string;
      interviewPreference?: string;
      recommendation?: string;
      notes?: string;
    },
  ) {
    return this.candidatesService.create(body);
  }

  /**
   * 候補者一覧を取得
   */
  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '候補者一覧' })
  async findAll() {
    return this.candidatesService.findAll();
  }

  // ---- 採用分析 ----
  @Get('analytics')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '採用経路別分析' })
  async getAnalytics(@Query('year') year?: string) {
    return this.candidatesService.getAnalytics(year ? parseInt(year, 10) : undefined);
  }

  // ---- 採用経路マスタ ----
  @Get('sources')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '採用経路一覧' })
  async getSources() {
    return this.candidatesService.getSources();
  }

  @Post('sources')
  @Roles('admin')
  @ApiOperation({ summary: '採用経路追加' })
  async createSource(@Body() body: { name: string; category: string; fee?: string; memo?: string }) {
    return this.candidatesService.createSource(body);
  }

  @Patch('sources/:id')
  @Roles('admin')
  @ApiOperation({ summary: '採用経路更新' })
  async updateSource(@Param('id', ParseUUIDPipe) id: string, @Body() body: { name?: string; category?: string; fee?: string; memo?: string }) {
    return this.candidatesService.updateSource(id, body);
  }

  @Delete('sources/:id')
  @Roles('admin')
  @ApiOperation({ summary: '採用経路削除' })
  async deleteSource(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.deleteSource(id);
  }

  // ---- 採用予算 ----
  @Get('budgets')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '採用予算取得' })
  async getBudgets(@Query('year') year: string) {
    return this.candidatesService.getBudgets(parseInt(year, 10) || new Date().getFullYear());
  }

  @Post('budgets')
  @Roles('admin')
  @ApiOperation({ summary: '採用予算更新' })
  async upsertBudget(@Body() body: { fiscalYear: number; category: string; month: number; budget?: number; actual?: number }) {
    return this.candidatesService.upsertBudget(body);
  }
}
