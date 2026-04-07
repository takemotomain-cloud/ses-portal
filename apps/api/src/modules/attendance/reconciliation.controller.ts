/**
 * Reconciliation Controller — 勤怠突合のREST APIエンドポイント
 *
 * エンドポイント:
 *   POST   /api/attendance/reconciliation/bulk-upload   — 一括アップロード＋社員自動マッチング
 *   POST   /api/attendance/reconciliation/bulk-confirm   — 一括取込確定
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
  UsePipes,
  UploadedFile,
  UploadedFiles,
  ParseUUIDPipe,
  BadRequestException,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
  private readonly logger = new Logger(ReconciliationController.name);

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * 対象月に稼働中の社員一覧
   */
  @Get('active-employees')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '稼働中社員一覧' })
  async getActiveEmployees(@Query('yearMonth') yearMonth: string) {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      const now = new Date();
      yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return this.reconciliationService.findActiveEmployees(yearMonth);
  }

  /**
   * 一括アップロード（複数ファイル）＋社員名自動マッチング
   * DB保存なし。解析結果と社員マッチングのみ返す。
   */
  @Post('bulk-upload')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '一括アップロード＋社員自動マッチング' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: false, forbidNonWhitelisted: false }))
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `attendance-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(xlsx|xls|csv|pdf|jpg|jpeg|png|gif|webp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(new BadRequestException('未対応のファイル形式です'), false);
        }
        cb(null, true);
      },
    }),
  )
  async bulkUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
  ) {
    // yearMonth はオプショナル。未指定時は当月をフォールバックとして使用
    const now = new Date();
    const fallbackYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearMonth = (body?.yearMonth && /^\d{4}-\d{2}$/.test(body.yearMonth))
      ? body.yearMonth
      : fallbackYm;
    this.logger.log(`bulk-upload: files=${files?.length}, yearMonth=${yearMonth}`);

    if (!files?.length) throw new BadRequestException('ファイルが指定されていません');

    const results = [];
    for (const file of files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      this.logger.log(`bulk-upload: processing file=${originalName}, path=${file.path}, mime=${file.mimetype}`);
      try {
        const parsed = await this.reconciliationService.parseOnly(file, yearMonth);
        const matchedEmployee = parsed.employeeName
          ? await this.reconciliationService.matchEmployeeByName(parsed.employeeName)
          : null;

        this.logger.log(`bulk-upload: parsed file=${originalName}, employee=${parsed.employeeName}, matched=${matchedEmployee?.lastName}`);

        // 稼働情報チェック + 開始時間自動補完
        let warning: string | null = null;
        let records = parsed.records;
        if (matchedEmployee) {
          const targetYm = parsed.yearMonth || yearMonth;
          const hasAssignment = await this.reconciliationService.hasActiveAssignment(matchedEmployee.id, targetYm);
          if (!hasAssignment) {
            warning = `${targetYm}に稼働情報がありません（待機中）`;
          } else {
            const defaultStart = await this.reconciliationService.getDefaultStartTime(matchedEmployee.id, targetYm);
            if (defaultStart) {
              records = this.reconciliationService.fillMissingStartTime(records, defaultStart);
            }
          }
        }

        results.push({
          fileName: originalName,
          filePath: file.path,
          employeeName: parsed.employeeName,
          matchedEmployee: matchedEmployee
            ? { id: matchedEmployee.id, name: `${matchedEmployee.lastName} ${matchedEmployee.firstName}`, employeeCode: matchedEmployee.employeeCode }
            : null,
          recordCount: records.length,
          yearMonth: parsed.yearMonth,
          records,
          summary: parsed.summary,
          client: parsed.client,
          error: null,
          warning,
        });
      } catch (err: any) {
        this.logger.error(`bulk-upload: error processing file=${originalName}: ${err.message}`, err.stack);
        results.push({
          fileName: originalName,
          filePath: file.path,
          employeeName: null,
          matchedEmployee: null,
          recordCount: 0,
          yearMonth,
          records: [],
          summary: null,
          client: null,
          error: err.message || '解析に失敗しました',
        });
      }
    }

    return { results };
  }

  /**
   * 一括取込確定
   * チェック済みのファイルをDBに保存＋突合実行
   */
  @Post('bulk-confirm')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '一括取込確定' })
  async bulkConfirm(
    @Body() body: {
      uploads: {
        employeeId: string;
        yearMonth: string;
        fileName: string;
        records: any[];
        summary: any;
        client: string | null;
      }[];
    },
  ) {
    if (!body.uploads?.length) {
      throw new BadRequestException('取込対象が指定されていません');
    }

    const results = [];
    for (const item of body.uploads) {
      try {
        const result = await this.reconciliationService.saveAndReconcile(
          item.employeeId,
          item.yearMonth,
          { records: item.records, summary: item.summary, client: item.client },
          item.fileName,
        );
        results.push({
          employeeId: item.employeeId,
          fileName: item.fileName,
          uploadId: result.uploadId,
          reconciliation: result.reconciliation,
          error: null,
        });
      } catch (err: any) {
        results.push({
          employeeId: item.employeeId,
          fileName: item.fileName,
          uploadId: null,
          reconciliation: null,
          error: err.message || '取込に失敗しました',
        });
      }
    }

    return { results };
  }

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

    // Step0.5: 稼働情報チェック — 対象月にアクティブな稼働がなければ拒否
    const hasAssignment = await this.reconciliationService.hasActiveAssignment(targetEmployeeId, yearMonth);
    if (!hasAssignment) {
      throw new BadRequestException('対象月に稼働情報がありません。稼働中の社員のみアップロードできます。');
    }

    // Step1: アップロード＋構造化
    const parsed = await this.reconciliationService.uploadAndParse(file, targetEmployeeId, yearMonth, clientId);

    // Step1.5: 社員（非admin）の場合、抽出した社員名が本人と一致するかチェック
    if (user.role !== 'admin') {
      const employee = await this.reconciliationService.getEmployee(targetEmployeeId);
      const extractedName = parsed.employeeName;
      if (!extractedName) {
        throw new BadRequestException('ファイルから社員名を読み取れませんでした。ファイルが間違っています。');
      }
      if (employee) {
        const normalize = (s: string) => s.replace(/[\s　]+/g, '');
        const fullName = `${employee.lastName}${employee.firstName}`;
        const nameMatch = normalize(extractedName) === fullName;
        const lastNameMatch = extractedName.includes(employee.lastName);
        if (!nameMatch && !lastNameMatch) {
          throw new BadRequestException('ファイルが間違っています。PDFに記載の社員名が本人と一致しません。');
        }
      }
    }

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

  @Get('employee/:employeeId/:yearMonth')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '社員月別突合結果取得' })
  async getResultsByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('yearMonth') yearMonth: string,
  ) {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new BadRequestException('yearMonth must be YYYY-MM format');
    }
    return this.reconciliationService.getReconcileResultsByEmployee(employeeId, yearMonth);
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
