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

  @Get('today')
  @ApiOperation({ summary: '今日の打刻状況' })
  async getToday(@CurrentUser() user: RequestUser) {
    return this.attendanceService.getToday(user.employeeId);
  }

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

  @Post('absent')
  @ApiOperation({ summary: '欠勤登録（当日）' })
  async markAbsent(@CurrentUser() user: RequestUser) {
    return this.attendanceService.markAbsent(user.employeeId);
  }

  @Post('absent-date')
  @ApiOperation({ summary: '日付指定の欠勤登録' })
  async markAbsentForDate(
    @CurrentUser() user: RequestUser,
    @Body() body: { date: string; reason?: string },
  ) {
    return this.attendanceService.markAbsentForDate(user.employeeId, body.date, body.reason);
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

  /* --- シフト計画 --- */

  @Get('shift/:yearMonth')
  @ApiOperation({ summary: '自分のシフト計画取得' })
  async getMyShift(
    @CurrentUser() user: RequestUser,
    @Param('yearMonth') yearMonth: string,
  ) {
    return this.attendanceService.getMyShift(user.employeeId, yearMonth);
  }

  @Post('shift/confirm')
  @ApiOperation({ summary: 'シフト確認' })
  async confirmShift(
    @CurrentUser() user: RequestUser,
    @Body() body: {
      yearMonth: string;
      isStandard: boolean;
      startTime?: string;
      customDays?: { day: number; isWorkDay: boolean; startTime: string }[];
    },
  ) {
    return this.attendanceService.confirmShift(user.employeeId, body);
  }

  /* --- アラート --- */

  @Get('alerts/my')
  @ApiOperation({ summary: '自分のアラート一覧' })
  async getMyAlerts(@CurrentUser() user: RequestUser) {
    return this.attendanceService.getMyAlerts(user.employeeId);
  }

  @Get('alerts/admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '管理者用アラート集約' })
  async getAdminAlerts() {
    return this.attendanceService.getAdminAlerts();
  }

  /* --- 管理者用: 月次ステータス一覧 --- */

  @Get('admin/status/:year/:month')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '管理者用: 全社員の勤怠ステータス一覧' })
  async getMonthlyStatus(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.attendanceService.getMonthlyStatus(year, month);
  }

  /* --- 管理者用: 指定社員の月次勤怠 --- */

  @Get('admin/:employeeId/:year/:month')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '管理者用: 指定社員の月次勤怠データ取得' })
  async getMonthlyByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.attendanceService.getMonthlyByEmployee(employeeId, year, month);
  }

  @Patch('admin/:employeeId/:workDate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '管理者用: 本人勤怠の修正' })
  async updateAttendanceByAdmin(
    @CurrentUser() user: RequestUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('workDate') workDate: string,
    @Body() body: { clockIn?: string; clockOut?: string; breakMinutes?: number; correction?: boolean },
  ) {
    return this.attendanceService.updateAttendanceByAdmin(employeeId, workDate, body, user.userId);
  }

  @Post('admin/:employeeId/confirm/:yearMonth')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '管理者用: 本人勤怠を一括確定' })
  async confirmAttendanceByAdmin(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('yearMonth') yearMonth: string,
  ) {
    return this.attendanceService.confirmAttendanceByAdmin(employeeId, yearMonth);
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
