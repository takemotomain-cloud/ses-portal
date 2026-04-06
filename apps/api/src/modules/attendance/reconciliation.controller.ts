/**
 * Reconciliation Controller — 勤怠突合のREST APIエンドポイント
 *
 * エンドポイント:
 *   POST   /api/attendance/reconciliation/upload        — 現場勤怠表アップロード＋構造化
 *   POST   /api/attendance/reconciliation/:uploadId/reconcile — 突合実行
 *   GET    /api/attendance/reconciliation/:uploadId      — 突合結果取得
 *   PUT    /api/attendance/reconciliation/:uploadId/confirm — 突合確定
 *   GET    /api/attendance/reconciliation/uploads        — アップロード一覧
 *   GET    /api/attendance/reconciliation/settings/:clientId — 突合設定取得
 *   PUT    /api/attendance/reconciliation/settings/:clientId — 突合設定更新
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
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
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DatabaseService } from '../../database/database.service';

const uploadDir = join(process.cwd(), 'uploads', 'attendance');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('勤怠突合')
@ApiBearerAuth()
@Controller('attendance/reconciliation')
@UseGuards(JwtAuthGuard)
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * 現場勤怠表アップロード＋構造化
   * 管理者: employeeId を指定して任意の社員分をアップロード可能
   * 社員:   自分の分のみアップロード可能（employeeId は自動設定）
   */
  @Post('upload')
  @ApiOperation({ summary: '現場勤怠表アップロード＋構造化' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `attendance-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(xlsx|xls|csv|pdf|jpg|jpeg|png|gif|webp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('未対応のファイル形式です'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('employeeId') employeeId: string,
    @Body('yearMonth') yearMonth: string,
    @Body('clientId') clientId?: string,
  ) {
    if (!file) throw new BadRequestException('ファイルが指定されていません');
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new BadRequestException('対象年月（YYYY-MM形式）が指定されていません');
    }

    // 社員は自分の分のみ（employeeIdが未指定なら自動設定）
    const targetEmployeeId = user.role === 'admin' && employeeId
      ? employeeId
      : user.employeeId;

    // Step1: アップロード＋構造化
    const parsed = await this.reconciliationService.uploadAndParse(file, targetEmployeeId, yearMonth, clientId);

    // Step2: 自動で突合実行
    let reconciliation = null;
    try {
      reconciliation = await this.reconciliationService.reconcile(parsed.uploadId, targetEmployeeId);
    } catch (e) {
      // 突合失敗してもアップロード自体は成功扱い
    }

    return {
      ...parsed,
      reconciliation,
    };
  }

  /**
   * 自分のアップロード一覧（社員用）
   */
  @Get('my-uploads')
  @ApiOperation({ summary: '自分のアップロード一覧' })
  async getMyUploads(@CurrentUser() user: RequestUser) {
    return this.db.clientAttendanceUpload.findMany({
      where: { employeeId: user.employeeId },
      include: {
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  @Post(':uploadId/reconcile')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '突合実行' })
  async reconcile(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
  ) {
    // アップロード情報から社員IDを取得
    const upload = await this.db.clientAttendanceUpload.findUnique({
      where: { id: uploadId },
    });
    if (!upload) throw new BadRequestException('アップロードデータが見つかりません');

    return this.reconciliationService.reconcile(uploadId, upload.employeeId);
  }

  @Get('uploads')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'アップロード一覧（管理者）' })
  async getUploads(
    @Query('yearMonth') yearMonth?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const where: any = {};
    if (yearMonth) where.yearMonth = yearMonth;
    if (employeeId) where.employeeId = employeeId;

    return this.db.clientAttendanceUpload.findMany({
      where,
      include: {
        employee: { select: { lastName: true, firstName: true, employeeCode: true } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get('settings/:clientId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '突合設定取得' })
  async getSettings(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.reconciliationService.getSettings(clientId);
  }

  @Put('settings/:clientId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '突合設定更新' })
  async updateSettings(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() body: {
      timeToleranceMin?: number;
      hoursTolerance?: number;
      breakIncluded?: boolean;
      roundingUnitMin?: number;
      defaultStartTime?: string;
    },
  ) {
    return this.reconciliationService.updateSettings(clientId, body);
  }

  @Get(':uploadId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '突合結果取得' })
  async getResults(@Param('uploadId', ParseUUIDPipe) uploadId: string) {
    return this.reconciliationService.getReconcileResults(uploadId);
  }

  @Put(':uploadId/confirm')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '突合確定' })
  async confirm(
    @CurrentUser() user: RequestUser,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Body() body: {
      updates?: {
        date: string;
        resolvedBy: string;
        resolvedStart?: string;
        resolvedEnd?: string;
        resolvedBreak?: number;
        resolvedHours?: number;
      }[];
    },
  ) {
    return this.reconciliationService.confirm(uploadId, user.employeeId, body.updates);
  }
}
