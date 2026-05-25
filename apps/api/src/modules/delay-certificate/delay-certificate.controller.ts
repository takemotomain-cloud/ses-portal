/**
 * Delay Certificate Controller — 遅延証明書のREST API
 *
 * エンドポイント:
 *   POST   /api/delay-certificates/submit         — 遅延証明書を提出（社員）
 *   GET    /api/delay-certificates/my              — 自分の提出一覧（社員）
 *   GET    /api/delay-certificates/pending         — 未確認一覧（管理者）
 *   GET    /api/delay-certificates                 — 全件一覧（管理者）
 *   POST   /api/delay-certificates/:id/confirm     — 確認済みにする（管理者）
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DelayCertificateService } from './delay-certificate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

const uploadDir = join(process.cwd(), 'uploads', 'delay-certificates');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('遅延証明書')
@ApiBearerAuth()
@Controller('delay-certificates')
@UseGuards(JwtAuthGuard)
export class DelayCertificateController {
  constructor(private readonly service: DelayCertificateService) {}

  @Post('submit')
  @ApiOperation({ summary: '遅延証明書を提出' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `delay-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|pdf)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('画像またはPDFファイルのみアップロード可能です'), false);
        }
        cb(null, true);
      },
    }),
  )
  async submit(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('targetDate') targetDate: string,
    @Body('route') route?: string,
    @Body('reason') reason?: string,
  ) {
    if (!targetDate) throw new BadRequestException('対象日付が指定されていません');

    // multerは日本語ファイル名をlatin1でエンコードするのでUTF-8にデコード
    const originalName = file
      ? Buffer.from(file.originalname, 'latin1').toString('utf8')
      : undefined;

    return this.service.submit(user.employeeId, {
      targetDate,
      route,
      reason,
      filePath: file ? `/uploads/delay-certificates/${file.filename}` : undefined,
      fileName: originalName,
    }, user.tenantId);
  }

  @Get('my')
  @ApiOperation({ summary: '自分の提出一覧' })
  async getMyList(@CurrentUser() user: RequestUser) {
    return this.service.getMyList(user.employeeId, user.tenantId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '未確認一覧（管理者）' })
  async getPending(@CurrentUser() user: RequestUser) {
    return this.service.getPending(user.tenantId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '全件一覧（管理者）' })
  async getAll(@CurrentUser() user: RequestUser) {
    return this.service.getAll(user.tenantId);
  }

  @Post(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '確認済みにする（管理者）' })
  async confirm(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirm(id, user.employeeId, user.tenantId);
  }
}
