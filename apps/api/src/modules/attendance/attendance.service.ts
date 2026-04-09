/**
 * Attendance Service
 *
 * 勤怠のビジネスロジック。
 *
 * 処理フロー:
 * 1. 出勤打刻: clock_inを記録、ステータスをnormalに
 * 2. 退勤打刻: clock_outを記録、work_minutes/overtime_minutesを自動計算
 * 3. 休憩変更: break_minutesを更新、稼働/残業を再計算
 * 4. 打刻漏れ検知: clock_outがNULLのまま翌日になったレコードを検出
 *
 * セキュリティ: 社員は自分の勤怠のみ操作可能。管理者は全社員を閲覧可能。
 * パフォーマンス: 月次データは最大31行。ページネーション不要。
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { STANDARD_WORK_MINUTES } from '@ses-portal/shared';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 出勤打刻
   *
   * 1日に2回出勤打刻はできない（UNIQUE制約で防止）。
   * 同日にレコードが既に存在する場合はエラー。
   */
  async clockIn(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 既に打刻済みか確認
    const existing = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: today,
        },
      },
    });

    if (existing?.clockIn) {
      throw new BadRequestException('本日は既に出勤打刻済みです');
    }

    const now = new Date();

    if (existing) {
      // 欠勤レコード等が先に作られている場合はUPDATE
      return this.db.attendance.update({
        where: { id: existing.id },
        data: {
          clockIn: now,
          status: 'normal',
          isMissedClock: false,
        },
      });
    }

    return this.db.attendance.create({
      data: {
        employeeId,
        workDate: today,
        clockIn: now,
        status: 'normal',
      },
    });
  }

  /**
   * 欠勤登録
   *
   * 当日のレコードを status: 'absent' で作成/更新。
   * 既に出勤済み（clockInあり）の場合はエラー。
   */
  async markAbsent(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: { employeeId, workDate: today },
      },
    });

    if (existing?.clockIn) {
      throw new BadRequestException('既に出勤打刻済みのため、欠勤登録できません');
    }

    if (existing?.status === 'absent') {
      throw new BadRequestException('本日は既に欠勤登録済みです');
    }

    if (existing) {
      return this.db.attendance.update({
        where: { id: existing.id },
        data: { status: 'absent', workMinutes: 0, overtimeMinutes: 0 },
      });
    }

    return this.db.attendance.create({
      data: {
        employeeId,
        workDate: today,
        status: 'absent',
        workMinutes: 0,
        overtimeMinutes: 0,
      },
    });
  }

  /**
   * 日付指定の欠勤登録
   *
   * 勤怠表から任意の日付を欠勤にする。管理者承認不要。
   */
  async markAbsentForDate(employeeId: string, dateStr: string, reason?: string) {
    const workDate = new Date(dateStr + 'T00:00:00Z');

    const existing = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: { employeeId, workDate },
      },
    });

    if (existing?.clockIn) {
      throw new BadRequestException('既に出勤打刻済みのため、欠勤登録できません');
    }

    if (existing?.status === 'absent') {
      throw new BadRequestException('この日は既に欠勤登録済みです');
    }

    if (existing) {
      return this.db.attendance.update({
        where: { id: existing.id },
        data: { status: 'absent', workMinutes: 0, overtimeMinutes: 0 },
      });
    }

    return this.db.attendance.create({
      data: {
        employeeId,
        workDate,
        status: 'absent',
        workMinutes: 0,
        overtimeMinutes: 0,
      },
    });
  }

  /**
   * 退勤打刻
   *
   * 出勤打刻がない場合はエラー。
   * 退勤時に稼働時間と残業時間を自動計算する。
   */
  async clockOut(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: today,
        },
      },
    });

    if (!record || !record.clockIn) {
      throw new BadRequestException('出勤打刻がありません');
    }

    if (record.clockOut) {
      throw new BadRequestException('本日は既に退勤打刻済みです');
    }

    const now = new Date();
    const clockInTime = new Date(record.clockIn);
    const totalMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);
    const workMinutes = totalMinutes - record.breakMinutes;
    const overtimeMinutes = Math.max(0, workMinutes - STANDARD_WORK_MINUTES);

    return this.db.attendance.update({
      where: { id: record.id },
      data: {
        clockOut: now,
        workMinutes,
        overtimeMinutes,
      },
    });
  }

  /**
   * 月次勤怠データ取得（有給情報付き）
   */
  async getMonthly(employeeId: string, year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0)); // 月末

    const records = await this.db.attendance.findMany({
      where: {
        employeeId,
        workDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { workDate: 'asc' },
    });

    // 承認済み有給申請を取得（当月に重なるもの）
    const approvedLeaves = await this.db.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'approved',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        startDate: true,
        endDate: true,
        days: true,
        leaveType: true,
      },
    });

    return { records, approvedLeaves };
  }

  /**
   * 管理者用: 指定社員の月次勤怠データ取得
   */
  async getMonthlyByEmployee(employeeId: string, year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const records = await this.db.attendance.findMany({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
      },
      orderBy: { workDate: 'asc' },
    });

    const employee = await this.db.employee.findFirst({
      where: { id: employeeId },
      select: { id: true, lastName: true, firstName: true, employeeCode: true },
    });

    return { employee, records };
  }

  /**
   * 休憩時間変更 → 稼働・残業を再計算
   */
  async updateBreak(attendanceId: string, employeeId: string, breakMinutes: number) {
    if (breakMinutes < 0 || breakMinutes > 480) {
      throw new BadRequestException('休憩時間は0〜480分で指定してください');
    }

    const record = await this.db.attendance.findFirst({
      where: { id: attendanceId, employeeId },
    });

    if (!record) {
      throw new NotFoundException('勤怠レコードが見つかりません');
    }

    // 稼働・残業の再計算
    let workMinutes = record.workMinutes;
    let overtimeMinutes = record.overtimeMinutes;

    if (record.clockIn && record.clockOut) {
      const totalMinutes = Math.floor(
        (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 60000,
      );
      workMinutes = totalMinutes - breakMinutes;
      overtimeMinutes = Math.max(0, workMinutes - STANDARD_WORK_MINUTES);
    }

    return this.db.attendance.update({
      where: { id: attendanceId },
      data: {
        breakMinutes,
        workMinutes,
        overtimeMinutes,
      },
    });
  }

  /**
   * 打刻漏れ検知
   *
   * clock_inがあってclock_outがNULLのまま前日以前のレコードを検出。
   * 日次バッチまたはログイン時に呼び出す。
   */
  async detectMissedClocks(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.db.attendance.findMany({
      where: {
        employeeId,
        clockIn: { not: null },
        clockOut: null,
        workDate: { lt: today },
        isMissedClock: false,
      },
    });
  }

  /* ==============================================
   * 勤怠修正申請
   * ============================================== */

  /**
   * 修正申請を作成
   *
   * 社員が出勤/退勤/休憩時間の修正を申請する。
   * 同じ勤怠レコードに対して未処理の申請がある場合はエラー。
   */
  async createCorrection(
    attendanceId: string,
    employeeId: string,
    data: {
      newClockIn?: string;
      newClockOut?: string;
      newBreakMinutes?: number;
      reason: string;
    },
  ) {
    // 勤怠レコードの存在＆所有権チェック
    const record = await this.db.attendance.findFirst({
      where: { id: attendanceId, employeeId },
    });

    if (!record) {
      throw new NotFoundException('勤怠レコードが見つかりません');
    }

    // 同じ勤怠レコードに対して未処理の申請がないか
    const pending = await this.db.attendanceCorrection.findFirst({
      where: { attendanceId, status: 'pending' },
    });

    if (pending) {
      throw new BadRequestException('この日付には既に未処理の修正申請があります');
    }

    // 修正内容のバリデーション
    if (!data.newClockIn && !data.newClockOut && data.newBreakMinutes === undefined) {
      throw new BadRequestException('修正する項目を1つ以上指定してください');
    }

    if (data.newBreakMinutes !== undefined && (data.newBreakMinutes < 0 || data.newBreakMinutes > 480)) {
      throw new BadRequestException('休憩時間は0〜480分で指定してください');
    }

    const correction = await this.db.attendanceCorrection.create({
      data: {
        attendanceId,
        employeeId,
        originalClockIn: record.clockIn,
        originalClockOut: record.clockOut,
        originalBreakMinutes: record.breakMinutes,
        newClockIn: data.newClockIn ? new Date(data.newClockIn) : null,
        newClockOut: data.newClockOut ? new Date(data.newClockOut) : null,
        newBreakMinutes: data.newBreakMinutes ?? null,
        reason: data.reason,
      },
    });

    this.logger.log(`勤怠修正申請を作成: employee=${employeeId}, attendance=${attendanceId}, correction=${correction.id}`);

    this.notifications.notifyAdmins('勤怠修正申請', '勤怠修正申請が提出されました。').catch(() => {});

    return { id: correction.id };
  }

  /**
   * 自分の修正申請一覧を取得
   */
  async getMyCorrections(employeeId: string) {
    return this.db.attendanceCorrection.findMany({
      where: { employeeId },
      include: {
        attendance: {
          select: { workDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 未処理の修正申請一覧（管理者用）
   */
  async getPendingCorrections() {
    return this.db.attendanceCorrection.findMany({
      where: { status: 'pending' },
      include: {
        employee: {
          select: { lastName: true, firstName: true, employeeCode: true },
        },
        attendance: {
          select: { workDate: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 修正申請を承認
   *
   * トランザクション内で:
   * 1. 申請ステータスを approved に更新
   * 2. 勤怠レコードに修正値を反映
   * 3. 稼働時間・残業時間を再計算
   */
  async approveCorrection(correctionId: string, approverId: string) {
    const correction = await this.db.attendanceCorrection.findFirst({
      where: { id: correctionId, status: 'pending' },
      include: { attendance: true },
    });

    if (!correction) {
      throw new NotFoundException('未処理の修正申請が見つかりません');
    }

    const result = await this.db.$transaction(async (tx) => {
      // 1. 申請ステータス更新
      await tx.attendanceCorrection.update({
        where: { id: correctionId },
        data: {
          status: 'approved',
          approverId,
          approvedAt: new Date(),
        },
      });

      // 2. 勤怠レコードに修正値を反映
      const clockIn = correction.newClockIn ?? correction.attendance.clockIn;
      const clockOut = correction.newClockOut ?? correction.attendance.clockOut;
      const breakMinutes = correction.newBreakMinutes ?? correction.attendance.breakMinutes;

      // 3. 稼働時間・残業時間を再計算
      let workMinutes = correction.attendance.workMinutes;
      let overtimeMinutes = correction.attendance.overtimeMinutes;

      if (clockIn && clockOut) {
        const totalMinutes = Math.floor(
          (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000,
        );
        workMinutes = totalMinutes - breakMinutes;
        overtimeMinutes = Math.max(0, workMinutes - STANDARD_WORK_MINUTES);
      }

      await tx.attendance.update({
        where: { id: correction.attendanceId },
        data: {
          clockIn,
          clockOut,
          breakMinutes,
          workMinutes,
          overtimeMinutes,
        },
      });

      this.logger.log(`勤怠修正を承認: correction=${correctionId}, approver=${approverId}`);

      return { id: correctionId };
    });

    this.notifications.create({ employeeId: correction.employeeId, title: '勤怠修正', body: '勤怠修正申請が承認されました。' }).catch(() => {});

    return result;
  }

  /**
   * 修正申請を却下
   */
  async rejectCorrection(correctionId: string, approverId: string, reason?: string) {
    const correction = await this.db.attendanceCorrection.findFirst({
      where: { id: correctionId, status: 'pending' },
    });

    if (!correction) {
      throw new NotFoundException('未処理の修正申請が見つかりません');
    }

    await this.db.attendanceCorrection.update({
      where: { id: correctionId },
      data: {
        status: 'rejected',
        approverId,
        approvedAt: new Date(),
        rejectReason: reason || null,
      },
    });

    this.logger.log(`勤怠修正を却下: correction=${correctionId}, approver=${approverId}`);

    this.notifications.create({ employeeId: correction.employeeId, title: '勤怠修正', body: '勤怠修正申請が却下されました。' }).catch(() => {});

    return { id: correctionId };
  }

  /* ==============================================
   * シフト計画
   * ============================================== */

  /**
   * 自分のシフト計画を取得
   */
  async getMyShift(employeeId: string, yearMonth: string) {
    return this.db.monthlyShift.findUnique({
      where: { employeeId_yearMonth: { employeeId, yearMonth } },
    });
  }

  /**
   * シフト確認（月初に社員が実行）
   *
   * isStandard=true: 土日祝休み → 平日を自動稼働日に
   * isStandard=false: customDays で手動指定
   */
  async confirmShift(
    employeeId: string,
    data: {
      yearMonth: string;
      isStandard: boolean;
      startTime?: string;
      customDays?: { day: number; isWorkDay: boolean; startTime: string }[];
    },
  ) {
    // isStandard の場合、アサインから開始時間を取得
    let startTime = data.startTime || '09:00';
    if (data.isStandard && !data.startTime) {
      const assignment = await this.db.assignment.findFirst({
        where: { employeeId, status: 'active' },
        orderBy: { startDate: 'desc' },
      });
      if (assignment) {
        // アサインに開始時間フィールドはないのでデフォルト 09:00
        startTime = '09:00';
      }
    }

    return this.db.monthlyShift.upsert({
      where: { employeeId_yearMonth: { employeeId, yearMonth: data.yearMonth } },
      create: {
        employeeId,
        yearMonth: data.yearMonth,
        isStandard: data.isStandard,
        startTime,
        customDays: data.isStandard ? Prisma.JsonNull : (data.customDays ?? Prisma.JsonNull),
        confirmedAt: new Date(),
      },
      update: {
        isStandard: data.isStandard,
        startTime,
        customDays: data.isStandard ? Prisma.JsonNull : (data.customDays ?? Prisma.JsonNull),
        confirmedAt: new Date(),
      },
    });
  }

  /* ==============================================
   * アラート
   * ============================================== */

  /**
   * 自分のアラート一覧
   */
  async getMyAlerts(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    // 1. 打刻漏れ（clockIn有 / clockOut無 で過去日、または isMissedClock）
    const missedClocks = await this.db.attendance.findMany({
      where: {
        employeeId,
        OR: [
          { clockIn: { not: null }, clockOut: null, workDate: { lt: today } },
          { isMissedClock: true },
        ],
      },
      orderBy: { workDate: 'desc' },
      select: { id: true, workDate: true, clockIn: true },
    });

    // 2. シフト未確認
    const shift = await this.db.monthlyShift.findUnique({
      where: { employeeId_yearMonth: { employeeId, yearMonth: currentYearMonth } },
    });
    const shiftUnconfirmed = !shift;

    // 3. 交通費未入力（月初〜10日の間のみチェック、前月分）
    let expenseMissing = false;
    if (now.getDate() <= 10) {
      const expense = await this.db.expenseRequest.findFirst({
        where: { employeeId, targetMonth: prevYearMonth },
      });
      expenseMissing = !expense;
    }

    // 4. 勤怠漏れ（月末経過後 = 前月のシフト計画 vs 実績の差分）
    const attendanceGaps: { date: string }[] = [];
    if (now.getDate() <= 10) {
      const prevShift = await this.db.monthlyShift.findUnique({
        where: { employeeId_yearMonth: { employeeId, yearMonth: prevYearMonth } },
      });

      if (prevShift) {
        const workDays = this.getWorkDaysFromShift(prevShift);
        const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
        const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);

        const records = await this.db.attendance.findMany({
          where: {
            employeeId,
            workDate: { gte: prevMonthStart, lte: prevMonthEnd },
          },
          select: { workDate: true },
        });

        const recordDays = new Set(records.map(r => new Date(r.workDate).getDate()));

        for (const day of workDays) {
          if (!recordDays.has(day)) {
            attendanceGaps.push({
              date: `${prevYearMonth}-${String(day).padStart(2, '0')}`,
            });
          }
        }
      }
    }

    return { missedClocks, shiftUnconfirmed, expenseMissing, attendanceGaps };
  }

  /**
   * 管理者用: 全社員のアラート集約
   */
  async getAdminAlerts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    // アクティブ社員一覧
    const activeEmployees = await this.db.employee.findMany({
      where: { status: 'active' },
      select: { id: true, lastName: true, firstName: true, employeeCode: true },
    });
    const empIds = activeEmployees.map(e => e.id);

    // 打刻漏れ
    const missedClocks = await this.db.attendance.findMany({
      where: {
        employeeId: { in: empIds },
        OR: [
          { clockIn: { not: null }, clockOut: null, workDate: { lt: today } },
          { isMissedClock: true },
        ],
      },
      include: {
        employee: { select: { id: true, lastName: true, firstName: true } },
      },
      orderBy: { workDate: 'desc' },
    });

    // シフト未確認者
    const confirmedShifts = await this.db.monthlyShift.findMany({
      where: { employeeId: { in: empIds }, yearMonth: currentYearMonth },
      select: { employeeId: true },
    });
    const confirmedIds = new Set(confirmedShifts.map(s => s.employeeId));
    const shiftUnconfirmed = activeEmployees.filter(e => !confirmedIds.has(e.id));

    // 交通費未入力（月初〜10日のみ）
    let expenseMissing: typeof activeEmployees = [];
    if (now.getDate() <= 10) {
      const expenses = await this.db.expenseRequest.findMany({
        where: { employeeId: { in: empIds }, targetMonth: prevYearMonth },
        select: { employeeId: true },
      });
      const expenseIds = new Set(expenses.map(e => e.employeeId));
      expenseMissing = activeEmployees.filter(e => !expenseIds.has(e.id));
    }

    return {
      missedClocks: missedClocks.map(m => ({
        employeeId: m.employeeId,
        employeeName: `${m.employee.lastName} ${m.employee.firstName}`,
        workDate: m.workDate,
      })),
      shiftUnconfirmed,
      expenseMissing,
    };
  }

  /**
   * 管理者による本人勤怠の修正
   * 出退勤時刻を更新し、workMinutes/overtimeMinutesを再計算する
   */
  async updateAttendanceByAdmin(
    employeeId: string,
    workDate: string,
    data: { clockIn?: string; clockOut?: string; breakMinutes?: number; correction?: boolean },
    userId?: string,
  ) {
    const date = new Date(workDate + 'T00:00:00Z');

    const record = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: date,
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`${workDate}の勤怠レコードが見つかりません`);
    }

    const updateData: any = {};

    if (data.clockIn !== undefined) {
      updateData.clockIn = new Date(`${workDate}T${data.clockIn}:00`);
    }
    if (data.clockOut !== undefined) {
      updateData.clockOut = new Date(`${workDate}T${data.clockOut}:00`);
    }
    if (data.breakMinutes !== undefined) {
      updateData.breakMinutes = data.breakMinutes;
    }

    // 再計算: clockIn と clockOut が確定していれば workMinutes/overtimeMinutes を再算出
    const finalClockIn = updateData.clockIn || record.clockIn;
    const finalClockOut = updateData.clockOut || record.clockOut;
    const finalBreak = updateData.breakMinutes ?? record.breakMinutes;

    if (finalClockIn && finalClockOut) {
      const totalMinutes = Math.floor(
        (new Date(finalClockOut).getTime() - new Date(finalClockIn).getTime()) / 60000,
      );
      updateData.workMinutes = totalMinutes - finalBreak;
      updateData.overtimeMinutes = Math.max(0, updateData.workMinutes - STANDARD_WORK_MINUTES);
    }

    const updated = await this.db.attendance.update({
      where: { id: record.id },
      data: updateData,
    });

    // 突合結果テーブル (reconciliation_results) の systemStart/systemEnd/systemHours も同期更新
    try {
      const reconUpdate: any = {};
      if (data.clockIn !== undefined) reconUpdate.systemStart = data.clockIn;
      if (data.clockOut !== undefined) reconUpdate.systemEnd = data.clockOut;
      if (data.breakMinutes !== undefined) reconUpdate.systemBreak = data.breakMinutes;
      if (updateData.workMinutes !== undefined) {
        reconUpdate.systemHours = parseFloat((updateData.workMinutes / 60).toFixed(2));
      }

      if (Object.keys(reconUpdate).length > 0) {
        // 該当社員・該当日の突合結果を全て更新（複数uploadがある場合も対応）
        const uploads = await this.db.clientAttendanceUpload.findMany({
          where: { employeeId, yearMonth: workDate.substring(0, 7) },
          select: { id: true },
        });
        if (uploads.length > 0) {
          await this.db.reconciliationResult.updateMany({
            where: {
              uploadId: { in: uploads.map(u => u.id) },
              workDate: date,
            },
            data: reconUpdate,
          });
        }
      }
    } catch {
      // 突合結果が存在しない場合は無視
    }

    // 確定後の修正時は監査ログを記録
    if (data.correction && userId) {
      try {
        const fmtTime = (d: Date | null) => d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;
        await this.db.auditLog.create({
          data: {
            userId,
            action: 'update',
            targetTable: 'attendances',
            targetId: record.id,
            oldValue: {
              clockIn: fmtTime(record.clockIn),
              clockOut: fmtTime(record.clockOut),
              workMinutes: record.workMinutes,
            },
            newValue: {
              clockIn: data.clockIn ?? fmtTime(record.clockIn),
              clockOut: data.clockOut ?? fmtTime(record.clockOut),
              workMinutes: updateData.workMinutes ?? record.workMinutes,
            },
          },
        });
      } catch {
        // ログ書き込み失敗は無視（本体の更新は成功済み）
      }
    }

    return updated;
  }

  /**
   * 管理者による本人勤怠の一括確定
   */
  async confirmAttendanceByAdmin(employeeId: string, yearMonth: string) {
    const [y, m] = yearMonth.split('-').map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0));

    const result = await this.db.attendance.updateMany({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
        status: { not: 'confirmed' },
      },
      data: { status: 'confirmed' },
    });

    return { confirmed: result.count };
  }

  /**
   * 管理者用: 全社員の勤怠ステータス一覧（本人確定・現場確定・現場取込）
   */
  async getMonthlyStatus(year: number, month: number) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    // 本人勤怠確定: 全レコードが confirmed かどうか
    const attendances = await this.db.attendance.findMany({
      where: { workDate: { gte: startDate, lte: endDate }, status: { not: 'confirmed' } },
      select: { employeeId: true },
    });
    const unconfirmedEmployees = new Set(attendances.map(a => a.employeeId));

    // 現場勤怠: uploads
    const uploads = await this.db.clientAttendanceUpload.findMany({
      where: { yearMonth: ym },
      select: { employeeId: true, status: true },
    });

    const uploadMap = new Map<string, { imported: boolean; confirmed: boolean }>();
    for (const u of uploads) {
      const existing = uploadMap.get(u.employeeId);
      const imported = true;
      const confirmed = u.status === 'confirmed' || (existing?.confirmed ?? false);
      uploadMap.set(u.employeeId, { imported, confirmed });
    }

    // 全社員IDを集約
    const allEmployeeIds = new Set<string>();
    attendances.forEach(a => allEmployeeIds.add(a.employeeId));

    // confirmed済みの社員も含めるため全attendanceを取得
    const allAttendances = await this.db.attendance.findMany({
      where: { workDate: { gte: startDate, lte: endDate } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    allAttendances.forEach(a => allEmployeeIds.add(a.employeeId));
    uploads.forEach(u => allEmployeeIds.add(u.employeeId));

    const result: Record<string, { attendanceConfirmed: boolean; clientConfirmed: boolean; clientImported: boolean }> = {};
    for (const eid of allEmployeeIds) {
      const upload = uploadMap.get(eid);
      result[eid] = {
        attendanceConfirmed: !unconfirmedEmployees.has(eid),
        clientConfirmed: upload?.confirmed ?? false,
        clientImported: upload?.imported ?? false,
      };
    }

    return result;
  }

  /**
   * シフト計画から稼働日リストを算出
   */
  private getWorkDaysFromShift(shift: { isStandard: boolean; yearMonth: string; customDays: unknown }): number[] {
    const [y, m] = shift.yearMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    if (!shift.isStandard && shift.customDays) {
      const custom = shift.customDays as { day: number; isWorkDay: boolean }[];
      return custom.filter(d => d.isWorkDay).map(d => d.day);
    }

    // 標準: 平日のみ
    const workDays: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      if (dow !== 0 && dow !== 6) {
        workDays.push(d);
      }
    }
    return workDays;
  }
}
