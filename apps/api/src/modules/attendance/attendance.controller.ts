/**
 * Attendance Controller
 *
 * 勤怠管理のREST APIエンドポイント。
 *
 * エンドポイント:
 *   POST   /api/attendance/clock-in          — 出勤打刻
 *   POST   /api/attendance/clock-out         — 退勤打刻
 *   GET    /api/attendance/:year/:month      — 月次勤怠データ
 *   PATCH  /api/attendance/:id/break         — 休憩時間変更
 *   GET    /api/attendance/missed            — 打刻漏れ検知
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
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

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

  @Get('missed')
  @ApiOperation({ summary: '打刻漏れ検知' })
  async getMissedClocks(@CurrentUser() user: RequestUser) {
    return this.attendanceService.detectMissedClocks(user.employeeId);
  }
}
