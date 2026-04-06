/**
 * Business Cards Controller
 *
 * 名刺スキャン・登録API
 *
 * POST /api/business-cards/scan  — 画像をアップロードしてOCR解析
 * POST /api/business-cards       — 名刺データを保存
 * GET  /api/business-cards       — 名刺一覧
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
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessCardsService } from './business-cards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('名刺管理')
@ApiBearerAuth()
@Controller('business-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessCardsController {
  constructor(private readonly service: BusinessCardsService) {}

  /**
   * 名刺画像をアップロードしてOCR解析
   */
  @Post('scan')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '名刺スキャン（OCR）' })
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('画像ファイルのみアップロード可能です'), false);
      }
      cb(null, true);
    },
  }))
  async scan(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('画像ファイルが必要です');
    }
    return this.service.scanImage(file.buffer, file.mimetype);
  }

  /**
   * 名刺データを保存
   */
  @Post()
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '名刺登録' })
  async create(
    @Body()
    body: {
      name: string;
      company: string;
      department?: string;
      title?: string;
      email?: string;
      phone?: string;
      address?: string;
      owner?: string;
      note?: string;
    },
  ) {
    return this.service.saveCard(body);
  }

  /**
   * 名刺一覧
   */
  @Get()
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '名刺一覧' })
  async findAll(@Query('search') search?: string) {
    return this.service.findAll({ search });
  }

  /**
   * 商談ログを追加
   */
  @Post(':id/logs')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '商談ログ追加' })
  async addLog(
    @Param('id') id: string,
    @Body()
    body: {
      date: string;
      content: string;
      recordingUrl?: string;
    },
  ) {
    if (!body.date || !body.content) {
      throw new BadRequestException('日付と内容は必須です');
    }
    return this.service.addDealLog({
      businessCardId: id,
      date: body.date,
      content: body.content,
      recordingUrl: body.recordingUrl,
    });
  }

  /**
   * 商談ログを更新
   */
  @Patch('logs/:logId')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '商談ログ更新' })
  async updateLog(
    @Param('logId') logId: string,
    @Body()
    body: {
      date?: string;
      content?: string;
      recordingUrl?: string;
    },
  ) {
    return this.service.updateDealLog(logId, body);
  }

  /**
   * 商談ログを削除
   */
  @Delete('logs/:logId')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '商談ログ削除' })
  async deleteLog(@Param('logId') logId: string) {
    return this.service.deleteDealLog(logId);
  }
}
