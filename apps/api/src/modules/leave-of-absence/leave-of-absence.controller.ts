/**
 * Leave of Absence Controller — 休職届 REST API
 *
 * エンドポイント:
 *   POST   /api/leave-of-absence/submit            — 休職届提出（社員、ファイル付き）
 *   GET    /api/leave-of-absence/my                 — 自分の休職届一覧（社員）
 *   GET    /api/leave-of-absence/pending            — 承認待ち一覧（管理者）
 *   POST   /api/leave-of-absence/:id/approve        — 承認（管理者）
 *   POST   /api/leave-of-absence/:id/reject         — 却下（管理者）
 *   POST   /api/leave-of-absence/:id/return         — 復職届提出（社員）
 *   POST   /api/leave-of-absence/:id/return-approve — 復職承認（管理者）
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
import { LeaveOfAbsenceService } from './leave-of-absence.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

const uploadDir = join(process.cwd(), 'uploads', 'leave-of-absence');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('休職届')
@ApiBearerAuth()
@Controller('leave-of-absence')
@UseGuards(JwtAuthGuard)
export class LeaveOfAbsenceController {
  constructor(private readonly service: LeaveOfAbsenceService) {}

  @Post('submit')
  @ApiOperation({ summary: '休職届を提出' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `loa-${uniqueSuffix}${ext}`);
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
    @Body('absenceType') absenceType: string,
    @Body('startDate') startDate: string,
    @Body('expectedReturnDate') expectedReturnDate: string,
    @Body('reason') reason?: string,
  ) {
    if (!absenceType || !startDate || !expectedReturnDate) {
      throw new BadRequestException('休職種別・開始日・復職予定日は必須です');
    }

    const originalName = file
      ? Buffer.from(file.originalname, 'latin1').toString('utf8')
      : undefined;

    return this.service.submit(user.employeeId, {
      absenceType,
      startDate,
      expectedReturnDate,
      reason,
      filePath: file?.path,
      fileName: originalName,
    });
  }

  @Get('my')
  @ApiOperation({ summary: '自分の休職届一覧' })
  async getMyList(@CurrentUser() user: RequestUser) {
    return this.service.getMyList(user.employeeId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '承認待ち休職届一覧' })
  async getPending() {
    return this.service.getPending();
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '休職届を承認' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.approve(id, user.employeeId);
    return { message: '承認しました' };
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '休職届を却下' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
  ) {
    await this.service.reject(id, user.employeeId, reason);
    return { message: '却下しました' };
  }

  @Post(':id/return')
  @ApiOperation({ summary: '復職届を提出' })
  async submitReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body('actualReturnDate') actualReturnDate: string,
  ) {
    if (!actualReturnDate) {
      throw new BadRequestException('復職日を指定してください');
    }
    return this.service.submitReturn(id, user.employeeId, actualReturnDate);
  }

  @Post(':id/return-approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '復職を承認' })
  async approveReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.approveReturn(id, user.employeeId);
    return { message: '復職を承認しました' };
  }
}
