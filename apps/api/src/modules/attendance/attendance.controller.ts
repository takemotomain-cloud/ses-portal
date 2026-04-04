/**
 * Attendance Controller
 *
 * 勤怠管理のREST APIエンドポイント。
 *
 * エンドポイント:
 *   POST   /api/attendance/clock-in                   — 出勤打刻
 *   POST   /api/attendance/clock-out                  — 退勤打刻
 *   GET    /api/attendance/corrections/my              — 自分の修正申請一覧
 *   GET    /api/attendance/corrections/pending         — 未処理修正申請（管理者）
 *   POST   /api/attendance/corrections/:id/approve    — 修正承認（管理者）
 *   POST   /api/attendance/corrections/:id/reject     — 修正却下（管理者）
 *   GET    /api/attendance/missed                     — 打刻漏れ検知
 *   GET    /api/attendance/:year/:month               — 月次勤怠データ
 *   PATCH  /api/attendance/:id/break                  — 休憩時間変更
 *   POST   /api/attendance/:id/correction             — 勤怠修正申請
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('勤怠管理')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  @ApiOperation({ summary: '出勤打刻' })
  async clockIn(@CurrentUser() user: RequestUser) {
    return this.attendanceService.clockIn(user.employeeId);
  }

  @Post('clock-out')
  @ApiOperation({ summary: '退勤打刻' })
  async clockOut(@CurrentUser() user: RequestUser) {
    return this.attendanceService.clockOut(user.employeeId);
  }

  /* --- 修正申請（固定パスを :year/:month より先に配置） --- */

  @Get('corrections/my')
  @ApiOperation({ summary: '自分の修正申請一覧' })
  async getMyCorrections(@CurrentUser() user: RequestUser) {
    return this.attendanceService.getMyCorrections(user.employeeId);
  }

  @Get('corrections/pending')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '未処理の修正申請一覧（管理者）' })
  async getPendingCorrections() {
    return this.attendanceService.getPendingCorrections();
  }

  @Post('corrections/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '修正申請を承認' })
  async approveCorrection(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendanceService.approveCorrection(id, user.employeeId);
  }

  @Post('corrections/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '修正申請を却下' })
  async rejectCorrection(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    return this.attendanceService.rejectCorrection(id, user.employeeId, body.reason);
  }

  @Get('missed')
  @ApiOperation({ summary: '打刻漏れ検知' })
  async getMissedClocks(@CurrentUser() user: RequestUser) {
    return this.attendanceService.detectMissedClocks(user.employeeId);
  }

  /* --- パラメータ付きルート（後方に配置） --- */

  @Get(':year/:month')
  @ApiOperation({ summary: '月次勤怠データ取得' })
  async getMonthly(
    @CurrentUser() user: RequestUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.attendanceService.getMonthly(user.employeeId, year, month);
  }

  @Patch(':id/break')
  @ApiOperation({ summary: '休憩時間変更' })
  async updateBreak(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('breakMinutes', ParseIntPipe) breakMinutes: number,
  ) {
    return this.attendanceService.updateBreak(id, user.employeeId, breakMinutes);
  }

  @Post(':id/correction')
  @ApiOperation({ summary: '勤怠修正申請' })
  async createCorrection(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      newClockIn?: string;
      newClockOut?: string;
      newBreakMinutes?: number;
      reason: string;
    },
  ) {
    return this.attendanceService.createCorrection(id, user.employeeId, body);
  }
}
