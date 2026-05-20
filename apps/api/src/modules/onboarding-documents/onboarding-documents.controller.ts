/**
 * OnboardingDocuments Controller
 *
 * エンドポイント:
 *   POST /onboarding-documents/:employeeId  — 単一書類アップロード（multipart）
 *     body: documentType (string), file (binary)
 *   GET  /onboarding-documents/:employeeId  — 社員の本人確認書類一覧
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import {
  OnboardingDocumentsService,
  ONBOARDING_DOCUMENT_TYPES,
} from './onboarding-documents.service';

const baseUploadDir = join(process.cwd(), 'uploads', 'onboarding-documents');
if (!existsSync(baseUploadDir)) mkdirSync(baseUploadDir, { recursive: true });

@ApiTags('入社書類')
@ApiBearerAuth()
@Controller('onboarding-documents')
@UseGuards(JwtAuthGuard)
export class OnboardingDocumentsController {
  constructor(private readonly service: OnboardingDocumentsService) {}

  @Post(':employeeId')
  @ApiOperation({ summary: '本人確認書類を1ファイルアップロード（社員別フォルダ）' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const empId = (req.params as any)?.employeeId || 'unknown';
          const dir = join(baseUploadDir, empId);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `ob-${unique}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|heic)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('画像またはPDFファイルのみアップロード可能です'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body('documentType') documentType: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!documentType) throw new BadRequestException('documentType が未指定です');
    if (!ONBOARDING_DOCUMENT_TYPES.includes(documentType as any)) {
      throw new BadRequestException(`未対応の documentType: ${documentType}`);
    }
    return this.service.uploadOne(user.tenantId, employeeId, documentType, file, user?.userId);
  }

  @Get(':employeeId')
  @ApiOperation({ summary: '社員の本人確認書類アップロード履歴' })
  async list(
    @CurrentUser() user: RequestUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.service.listByEmployee(user.tenantId, employeeId);
  }
}
