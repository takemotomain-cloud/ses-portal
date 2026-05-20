/**
 * GeneralExpense Controller — 事前申請 + 一般経費申請
 *
 * 事前申請:
 *   POST /api/general-expense/pre-approval        — 事前申請
 *   GET  /api/general-expense/pre-approval/my      — 自分の事前申請一覧
 *   GET  /api/general-expense/pre-approval/unused   — 承認済み未使用の事前申請
 *   GET  /api/general-expense/pre-approval/all      — 全事前申請一覧（管理者用）
 *   POST /api/general-expense/pre-approval/:id/approve
 *   POST /api/general-expense/pre-approval/:id/reject
 *
 * 経費申請:
 *   POST /api/general-expense/submit               — 経費申請
 *   GET  /api/general-expense/my                    — 自分の経費申請一覧
 *   GET  /api/general-expense/all                   — 全経費申請一覧（管理者用）
 *   POST /api/general-expense/:id/approve
 *   POST /api/general-expense/:id/reject
 */

import {
  Controller, Get, Post, Param, Body, Query, Req, UseGuards, UseInterceptors,
  UploadedFile, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GeneralExpenseService } from './general-expense.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

const uploadDir = join(process.cwd(), 'uploads', 'general-expense-receipts');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

@ApiTags('一般経費')
@ApiBearerAuth()
@Controller('general-expense')
@UseGuards(JwtAuthGuard)
export class GeneralExpenseController {
  constructor(private readonly service: GeneralExpenseService) {}

  // ==================== 事前申請 ====================

  @Post('pre-approval')
  @ApiOperation({ summary: '事前申請を提出' })
  async createPreApproval(
    @CurrentUser() user: RequestUser,
    @Body() body: { expectedDate: string; description: string; estimatedAmount: number },
  ) {
    return this.service.createPreApproval(user.employeeId, {
      expectedDate: body.expectedDate,
      description: body.description,
      estimatedAmount: body.estimatedAmount,
    }, user.tenantId);
  }

  @Get('pre-approval/my')
  @ApiOperation({ summary: '自分の事前申請一覧' })
  async getMyPreApprovals(@CurrentUser() user: RequestUser) {
    return this.service.getMyPreApprovals(user.employeeId, user.tenantId);
  }

  @Get('pre-approval/unused')
  @ApiOperation({ summary: '承認済み未使用の事前申請一覧' })
  async getApprovedUnused(@CurrentUser() user: RequestUser) {
    return this.service.getMyApprovedUnusedPreApprovals(user.employeeId, user.tenantId);
  }

  @Get('pre-approval/all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '全事前申請一覧（管理者用）' })
  async getAllPreApprovals(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.service.getAllPreApprovals(user.tenantId, status);
  }

  @Post('pre-approval/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '事前申請を承認' })
  async approvePreApproval(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.service.approvePreApproval(id, user.employeeId, user.tenantId, user.userId);
    return { message: '承認しました' };
  }

  @Post('pre-approval/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '事前申請を却下' })
  async rejectPreApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
  ) {
    await this.service.rejectPreApproval(id, user.employeeId, user.tenantId, user.userId, reason);
    return { message: '却下しました' };
  }

  // ==================== 経費申請 ====================

  @Post('submit')
  @ApiOperation({ summary: '経費申請を提出' })
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `general-${uniqueSuffix}${extname(file.originalname)}`);
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
  async submit(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const { expenseDate, description, amount, preApprovalId } = req.body || {};
    return this.service.createExpense(
      user.employeeId,
      user.role,
      {
        expenseDate,
        description,
        amount: parseInt(amount, 10),
        preApprovalId: preApprovalId || undefined,
      },
      user.tenantId,
      file,
    );
  }

  @Get('my')
  @ApiOperation({ summary: '自分の経費申請一覧' })
  async getMy(@CurrentUser() user: RequestUser) {
    return this.service.getMyExpenses(user.employeeId, user.tenantId);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '全経費申請一覧（管理者用）' })
  async getAll(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.service.getAllExpenses(user.tenantId, status);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '経費申請を承認' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    await this.service.approveExpense(id, user.employeeId, user.tenantId, user.userId);
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
    await this.service.rejectExpense(id, user.employeeId, user.tenantId, user.userId, reason);
    return { message: '却下しました' };
  }
}
