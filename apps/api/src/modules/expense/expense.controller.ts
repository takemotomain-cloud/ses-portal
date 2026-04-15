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

    // ファイル名のプレフィックス(receipt_0_, receipt_1_,...)で明細とマッチング
    const fileMap = new Map<number, Express.Multer.File>();
    for (const f of (files || [])) {
      const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const match = originalName.match(/^receipt_(\d+)_/);
      if (match) {
        fileMap.set(parseInt(match[1], 10), f);
      }
    }

    return this.expenseService.createRequest(user.employeeId, { targetMonth, items }, fileMap);
  }

  @Get('my')
  @ApiOperation({ summary: '自分の経費申請一覧' })
  async getMyRequests(@CurrentUser() user: RequestUser) {
    return this.expenseService.getMyRequests(user.employeeId);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '全ステータス経費申請一覧（管理者用・月別）' })
  async getAll(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('status') status?: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (isNaN(y) || isNaN(m)) throw new BadRequestException('year/monthは必須です');
    const targetMonth = `${y}-${String(m).padStart(2, '0')}`;
    return this.expenseService.getAllRequests(targetMonth, status);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '承認待ち経費申請一覧（管理者用）' })
  async getPending() {
    return this.expenseService.getPendingRequests();
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '経費申請を承認' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.expenseService.approve(id, user.employeeId, user.userId, user.role);
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
    await this.expenseService.reject(id, user.employeeId, user.userId, user.role, reason);
    return { message: '却下しました' };
  }
}
