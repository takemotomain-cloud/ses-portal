/**
 * Expense Controller
 *
 * POST /api/expense/request       — 経費申請（明細付き・領収書添付）
 * GET  /api/expense/my             — 自分の経費申請一覧
 * GET  /api/expense/pending        — 承認待ち一覧（管理者用）
 * GET  /api/expense/all            — 全ステータス経費一覧（管理者用・月別）
 * POST /api/expense/:id/approve    — 承認
 * POST /api/expense/:id/reject     — 却下
 */

import {
  Controller, Get, Post, Param, Body, Query, Req, UseGuards, UseInterceptors,
  UploadedFiles, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

const uploadDir = join(process.cwd(), 'uploads', 'expense-receipts');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

@ApiTags('経費精算')
@ApiBearerAuth()
@Controller('expense')
@UseGuards(JwtAuthGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post('request')
  @ApiOperation({ summary: '交通費申請（都度 / 定期 混在可、明細付き・領収書添付）' })
  @UseInterceptors(
    FilesInterceptor('receipts', 20, {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `receipt-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|pdf)$/i;
        if (!allowed.test(extname(file.originalname))) {
          return cb(new BadRequestException('対応ファイル形式: JPG, PNG, GIF, WebP, PDF') as any, false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async createRequest(
    @CurrentUser() user: RequestUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const targetMonth = req.body?.targetMonth as string;
    const itemsJson = req.body?.items as string;

    if (!itemsJson) {
      throw new BadRequestException('明細データが送信されていません');
    }

    let items: any[];
    try {
      items = JSON.parse(itemsJson);
    } catch {
      throw new BadRequestException('明細データの形式が不正です');
    }

    if (!items || items.length === 0) {
      throw new BadRequestException('明細が1件もありません');
    }
    const fileMap = new Map<number, Express.Multer.File>();
    if (files && files.length > 0) {
      for (const file of files) {
        // multipart/form-data で receipts_0, receipts_1 ... のように送られてくる想定
        const match = file.fieldname.match(/^receipts_(\d+)$/);
        if (match) {
          fileMap.set(parseInt(match[1], 10), file);
        }
      }
    }

    return this.expenseService.createRequest(user.employeeId, { targetMonth, items }, fileMap, user.tenantId);
  }

  @Get('my')
  @ApiOperation({ summary: '自分の経費申請一覧' })
  async getMyRequests(@CurrentUser() user: RequestUser) {
    return this.expenseService.getMyRequests(user.employeeId, user.tenantId);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '全ステータス経費申請一覧（管理者用・月別）' })
  async getAll(
    @CurrentUser() user: RequestUser,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('status') status?: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (isNaN(y) || isNaN(m)) throw new BadRequestException('year/monthは必須です');
    const targetMonth = `${y}-${String(m).padStart(2, '0')}`;
    return this.expenseService.getAllRequests(targetMonth, status, user.tenantId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '承認待ち経費申請一覧（管理者用）' })
  async getPending(@CurrentUser() user: RequestUser) {
    return this.expenseService.getPendingRequests(user.tenantId);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '経費申請を承認' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.expenseService.approve(id, user.employeeId, user.tenantId, user.userId, user.role);
    return { message: '承認しました' };
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '経費申請を却下' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
  ) {
    await this.expenseService.reject(id, user.employeeId, user.tenantId, user.userId, user.role, reason);
    return { message: '却下しました' };
  }
}
