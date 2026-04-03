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
  Body,
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
  @Roles('admin', 'sales')
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
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '候補者一覧' })
  async findAll() {
    return this.candidatesService.findAll();
  }
}
