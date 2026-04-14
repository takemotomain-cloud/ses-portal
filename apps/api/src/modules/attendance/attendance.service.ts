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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { AttendanceConfirmedEvent } from './events/attendance-confirmed.event';
import { STANDARD_WORK_MINUTES } from '@ses-portal/shared';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly googleDrive: GoogleDriveService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 今日の打刻状況を取得
   *
   * マイページ初期表示で「出勤中」「未出勤」を判定するために使う。
   * レコードが存在しない場合は両方 null を返す。
   */
  async getToday(employeeId: string): Promise<{ clockIn: string | null; clockOut: string | null }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate: today,
        },
      },
      select: { clockIn: true, clockOut: true },
    });

    return {
      clockIn: record?.clockIn ? record.clockIn.toISOString() : null,
      clockOut: record?.clockOut ? record.clockOut.toISOString() : null,
    };
  }

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

      // 2.5. clockIn/clockOut の整合性チェック
      if (clockIn && clockOut && new Date(clockIn).getTime() > new Date(clockOut).getTime()) {
        throw new BadRequestException(
          `出勤時刻が退勤時刻より後になるため承認できません（出勤: ${new Date(clockIn).toISOString()}, 退勤: ${new Date(clockOut).toISOString()}）。先に出勤時刻を修正してください。`,
        );
      }

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

      // 確定済み月への修正 → has_post_close_changes フラグを立てる
      const workDate = correction.attendance.workDate as Date;
      const corrYearMonth = `${workDate.getFullYear()}-${String(workDate.getMonth() + 1).padStart(2, '0')}`;
      const closure = await tx.attendanceMonthlyClosure.findUnique({
        where: { yearMonth: corrYearMonth },
      });
      if (closure?.status === 'closed') {
        await tx.attendanceMonthlyClosure.update({
          where: { yearMonth: corrYearMonth },
          data: { hasPostCloseChanges: true },
        });
        this.logger.warn(`確定済み月 ${corrYearMonth} への修正承認 → 警告フラグ ON`);
      }

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

    // 3. 交通費（定期券）未申請アラート
    //
    // 社員マスタの commuteStyle に応じて判定:
    //   - onetime     : アラートなし（過去3ヶ月遡れるので救済可能）
    //   - monthly     : 毎月15日/月末に判定、当月の定期 or 都度申請が1件もなければアラート
    //   - three_month : 毎月15日/月末に判定、現在月をカバーする定期 or 当月の都度申請が1件もなければアラート
    //
    // 判定日: 当月15日以降 or 月末日
    let expenseMissing = false;
    const employee = await this.db.employee.findUnique({
      where: { id: employeeId },
      select: { commuteStyle: true },
    });

    if (employee && (employee.commuteStyle === 'monthly' || employee.commuteStyle === 'three_month')) {
      const dayOfMonth = now.getDate();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const shouldCheck = dayOfMonth >= 15 || dayOfMonth === lastDay;

      if (shouldCheck) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // 当月の都度申請
        const onetimeInMonth = await this.db.expenseItem.findFirst({
          where: {
            kind: 'onetime',
            expenseDate: { gte: monthStart, lte: monthEnd },
            expenseRequest: {
              employeeId,
              status: { in: ['pending', 'approved'] },
            },
          },
          select: { id: true },
        });

        let passCovered = false;
        if (employee.commuteStyle === 'monthly') {
          // 1ヶ月定期: 当月に開始される定期券
          const monthlyPass = await this.db.expenseItem.findFirst({
            where: {
              kind: 'monthly_pass',
              expenseDate: { gte: monthStart, lte: monthEnd },
              expenseRequest: {
                employeeId,
                status: { in: ['pending', 'approved'] },
              },
            },
            select: { id: true },
          });
          passCovered = !!monthlyPass;
        } else {
          // 3ヶ月定期: 有効期間が現在月をカバーする定期券（先行申請もカバー）
          const threeMonthPass = await this.db.expenseItem.findFirst({
            where: {
              kind: 'three_month_pass',
              expenseDate: { lte: monthEnd },
              passEndDate: { gte: monthStart },
              expenseRequest: {
                employeeId,
                status: { in: ['pending', 'approved'] },
              },
            },
            select: { id: true },
          });
          passCovered = !!threeMonthPass;
        }

        expenseMissing = !passCovered && !onetimeInMonth;
      }
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
    data: { clockIn?: string; clockOut?: string; breakMinutes?: number; correction?: boolean; reason?: string },
    userId?: string,
  ) {
    // 修正理由は必須
    if (!data.reason || data.reason.trim() === '') {
      throw new BadRequestException('修正理由を入力してください');
    }
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

    // 管理者修正履歴を記録 + 通知
    if (userId) {
      try {
        const modifiedFields: string[] = [];
        if (data.clockIn !== undefined && updateData.clockIn?.getTime() !== record.clockIn?.getTime()) modifiedFields.push('clockIn');
        if (data.clockOut !== undefined && updateData.clockOut?.getTime() !== record.clockOut?.getTime()) modifiedFields.push('clockOut');
        if (data.breakMinutes !== undefined && data.breakMinutes !== record.breakMinutes) modifiedFields.push('breakMinutes');

        if (modifiedFields.length > 0) {
          // 同じ attendanceId の未解決異議を自動解消
          await this.db.adminAttendanceEdit.updateMany({
            where: {
              attendanceId: record.id,
              objectionStatus: 'objected',
            },
            data: {
              objectionStatus: 'resolved',
              resolvedAt: new Date(),
            },
          });

          const edit = await this.db.adminAttendanceEdit.create({
            data: {
              attendanceId: record.id,
              employeeId,
              adminUserId: userId,
              workDate: date,
              oldClockIn: record.clockIn,
              oldClockOut: record.clockOut,
              oldBreakMinutes: record.breakMinutes,
              newClockIn: updateData.clockIn ?? record.clockIn,
              newClockOut: updateData.clockOut ?? record.clockOut,
              newBreakMinutes: updateData.breakMinutes ?? record.breakMinutes,
              modifiedFields,
              reason: data.reason!,
            },
          });

          // 社員に通知
          const fmtT = (d: Date | null) => d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--';
          const changes: string[] = [];
          if (modifiedFields.includes('clockIn')) changes.push(`出勤: ${fmtT(record.clockIn)} → ${fmtT(updateData.clockIn ?? record.clockIn)}`);
          if (modifiedFields.includes('clockOut')) changes.push(`退勤: ${fmtT(record.clockOut)} → ${fmtT(updateData.clockOut ?? record.clockOut)}`);
          if (modifiedFields.includes('breakMinutes')) changes.push(`休憩: ${record.breakMinutes}分 → ${updateData.breakMinutes ?? record.breakMinutes}分`);

          await this.notifications.create({
            employeeId,
            title: `${workDate} の勤怠が修正されました`,
            body: `${changes.join(' / ')}\n理由: ${data.reason}`,
            category: 'attendance_edit',
            metadata: { editId: edit.id, type: 'attendance_edit' },
          });
        }
      } catch {
        // 修正履歴・通知の作成失敗は無視
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

    // 未解決の異議があれば確定をブロック
    const unresolvedCount = await this.db.adminAttendanceEdit.count({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
        objectionStatus: 'objected',
      },
    });
    if (unresolvedCount > 0) {
      throw new BadRequestException(
        `未解決の異議が${unresolvedCount}件あります。異議を解決してから確定してください。`,
      );
    }

    // 既存レコードを confirmed に更新
    const result = await this.db.attendance.updateMany({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
        status: { not: 'confirmed' },
      },
      data: { status: 'confirmed' },
    });

    // レコードが存在しない日に confirmed レコードを作成（社内勤怠など打刻なし社員向け）
    const existing = await this.db.attendance.findMany({
      where: { employeeId, workDate: { gte: startDate, lte: endDate } },
      select: { workDate: true },
    });
    const existingDates = new Set(
      existing.map((r) => r.workDate.toISOString().slice(0, 10)),
    );
    const creates: any[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!existingDates.has(key)) {
        creates.push({
          employeeId,
          workDate: new Date(d),
          breakMinutes: 0,
          status: 'confirmed',
        });
      }
    }
    if (creates.length > 0) {
      await this.db.attendance.createMany({ data: creates });
    }

    // Google Drive にスプシ保存（非同期・エラー無視）
    this.saveAttendanceToGoogleDrive(employeeId, y, m, startDate, endDate).catch(e => {
      this.logger.warn(`Google Drive 保存エラー: ${(e as Error).message}`);
    });

    // 勤怠確定 → 給与自動計算をトリガー
    this.eventEmitter.emit(
      'attendance.confirmed',
      new AttendanceConfirmedEvent(employeeId, yearMonth),
    );

    return { confirmed: result.count + creates.length };
  }

  /**
   * 本人勤怠確定データを Google Sheets に保存
   */
  private async saveAttendanceToGoogleDrive(
    employeeId: string, year: number, month: number,
    startDate: Date, endDate: Date,
  ) {
    if (!this.googleDrive.isEnabled()) return;

    const [employee, assignment, records] = await Promise.all([
      this.db.employee.findUnique({
        where: { id: employeeId },
        select: { lastName: true, firstName: true },
      }),
      this.db.assignment.findFirst({
        where: { employeeId, status: 'active' },
        include: { client: { select: { name: true } } },
      }),
      this.db.attendance.findMany({
        where: { employeeId, workDate: { gte: startDate, lte: endDate } },
        orderBy: { workDate: 'asc' },
      }),
    ]);

    if (!employee || !records.length) return;

    const empName = `${employee.lastName} ${employee.firstName}`;
    const clientName = assignment?.client?.name || '未アサイン';
    const fileName = `${empName}_${clientName}_${year}年${month}月`;

    const fmtTime = (d: Date | null) => {
      if (!d) return '';
      const dt = new Date(d);
      return `${String(dt.getUTCHours() + 9).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
    };
    const fmtMin = (m: number | null) => m != null ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : '';

    const headers = ['日付', '出勤', '退勤', '休憩(分)', '稼働時間', '残業時間'];
    const rows = records.map(r => {
      const wd = new Date(r.workDate);
      const dateStr = `${wd.getUTCMonth() + 1}/${wd.getUTCDate()}`;
      return [dateStr, fmtTime(r.clockIn), fmtTime(r.clockOut), r.breakMinutes, fmtMin(r.workMinutes), fmtMin(r.overtimeMinutes)];
    });

    const folders = await this.googleDrive.ensureMonthlyFolders(year, month);
    const url = await this.googleDrive.saveAttendanceSheet({
      folderId: folders.selfFolderId,
      fileName,
      headers,
      rows,
    });

    this.logger.log(`本人勤怠スプシ保存: ${url}`);
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

    // アクティブな案件の現場勤怠要否を取得
    const activeAssignments = await this.db.assignment.findMany({
      where: {
        employeeId: { in: [...allEmployeeIds] },
        status: 'active',
        deletedAt: null,
      },
      select: { employeeId: true, clientAttendanceRequired: true },
    });
    const assignmentMap = new Map<string, boolean>();
    for (const a of activeAssignments) {
      assignmentMap.set(a.employeeId, a.clientAttendanceRequired);
    }

    const result: Record<string, any> = {};
    for (const eid of allEmployeeIds) {
      const upload = uploadMap.get(eid);
      const clientAttendanceRequired = assignmentMap.get(eid) ?? true;
      result[eid] = {
        attendanceConfirmed: !unconfirmedEmployees.has(eid),
        clientConfirmed: upload?.confirmed ?? false,
        clientImported: upload?.imported ?? false,
        clientAttendanceRequired,
      };
    }

    // 異議あり（月内の未解決分）— 件数 + 詳細リスト
    const objections = await this.db.adminAttendanceEdit.findMany({
      where: {
        workDate: { gte: startDate, lte: endDate },
        objectionStatus: 'objected',
      },
      select: {
        id: true, workDate: true, modifiedFields: true, reason: true, objectionReason: true,
        employeeId: true,
        employee: { select: { lastName: true, firstName: true } },
      },
      orderBy: { workDate: 'asc' },
    });

    result._summary = {
      objectionCount: objections.length,
      objections: objections.map(o => ({
        id: o.id,
        employeeId: o.employeeId,
        employeeName: `${o.employee.lastName} ${o.employee.firstName}`,
        workDate: o.workDate,
        modifiedFields: o.modifiedFields,
        reason: o.reason,
        objectionReason: o.objectionReason,
      })),
    };

    return result;
  }

  // ============================================================
  // 月次勤怠確定（closure）— 給与計算ゲート
  // ============================================================

  /**
   * 確定ステータス + 未確定社員リスト（readiness）を取得
   */
  async getClosureStatus(year: number, month: number) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

    const closure = await this.db.attendanceMonthlyClosure.findUnique({
      where: { yearMonth },
    });

    // 在籍社員（admin 以外）を取得
    const employees = await this.db.employee.findMany({
      where: { status: 'active', deletedAt: null },
      include: {
        user: { select: { role: true } },
        department: { select: { name: true } },
      },
    });

    const nonAdminEmployees = employees.filter(
      (e) => e.user?.role !== 'admin',
    );

    // 当月に勤怠レコードが 1 件以上あるかチェック
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const attendanceCounts = await this.db.attendance.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: nonAdminEmployees.map((e) => e.id) },
        workDate: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    const employeesWithAttendance = new Set(
      attendanceCounts.map((a) => a.employeeId),
    );

    const unconfirmedEmployees = nonAdminEmployees
      .filter((e) => !employeesWithAttendance.has(e.id))
      .map((e) => ({
        employeeId: e.id,
        name: `${e.lastName} ${e.firstName}`,
        employeeCode: e.employeeCode,
        departmentName: e.department?.name || '',
      }));

    const adminCount = employees.filter(
      (e) => e.user?.role === 'admin',
    ).length;

    return {
      yearMonth,
      status: closure?.status || 'open',
      closedAt: closure?.closedAt || null,
      hasPostCloseChanges: closure?.hasPostCloseChanges || false,
      readiness: {
        totalEmployees: employees.length,
        confirmedCount: nonAdminEmployees.length - unconfirmedEmployees.length,
        exemptCount: adminCount,
        unconfirmedEmployees,
      },
    };
  }

  /**
   * 月次勤怠を一括確定（admin のみ）
   *
   * admin 以外の全在籍社員に当月の勤怠レコードが存在することを確認してから確定。
   */
  async closeMonth(year: number, month: number, closedByEmployeeId: string) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

    // 既に確定済みかチェック
    const existing = await this.db.attendanceMonthlyClosure.findUnique({
      where: { yearMonth },
    });
    if (existing?.status === 'closed') {
      throw new BadRequestException(`${yearMonth}の勤怠は既に確定されています`);
    }

    // readiness チェック
    const status = await this.getClosureStatus(year, month);
    if (status.readiness.unconfirmedEmployees.length > 0) {
      const names = status.readiness.unconfirmedEmployees
        .map((e) => `${e.employeeCode} ${e.name}`)
        .join(', ');
      throw new BadRequestException(
        `以下の社員の勤怠が未入力です: ${names}`,
      );
    }

    // UPSERT で確定
    await this.db.attendanceMonthlyClosure.upsert({
      where: { yearMonth },
      create: {
        yearMonth,
        status: 'closed',
        closedAt: new Date(),
        closedBy: closedByEmployeeId,
      },
      update: {
        status: 'closed',
        closedAt: new Date(),
        closedBy: closedByEmployeeId,
        hasPostCloseChanges: false,
      },
    });

    this.logger.log(`月次勤怠確定: ${yearMonth} by ${closedByEmployeeId}`);
    return { yearMonth, status: 'closed' };
  }

  /**
   * 月次勤怠確定を解除（admin のみ）
   */
  async reopenMonth(year: number, month: number, reopenedByEmployeeId: string) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

    const closure = await this.db.attendanceMonthlyClosure.findUnique({
      where: { yearMonth },
    });
    if (!closure || closure.status !== 'closed') {
      throw new BadRequestException(`${yearMonth}の勤怠は確定されていません`);
    }

    await this.db.attendanceMonthlyClosure.update({
      where: { yearMonth },
      data: {
        status: 'open',
        reopenedAt: new Date(),
        reopenedBy: reopenedByEmployeeId,
      },
    });

    this.logger.log(`月次勤怠確定解除: ${yearMonth} by ${reopenedByEmployeeId}`);
    return { yearMonth, status: 'open' };
  }

  // ============================================================
  // 管理者修正への異議申し立て
  // ============================================================

  /**
   * 社員が管理者修正に異議を申し立てる
   */
  async objectToAdminEdit(editId: string, employeeId: string, reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('異議の理由を入力してください');
    }

    const edit = await this.db.adminAttendanceEdit.findFirst({
      where: { id: editId, employeeId },
      include: { employee: { select: { lastName: true, firstName: true, employeeCode: true } } },
    });

    if (!edit) {
      throw new NotFoundException('修正履歴が見つかりません');
    }

    if (edit.objectionStatus !== 'none') {
      throw new BadRequestException('この修正には既に異議が申し立てられています');
    }

    await this.db.adminAttendanceEdit.update({
      where: { id: editId },
      data: {
        objectionStatus: 'objected',
        objectionReason: reason,
        objectionAt: new Date(),
      },
    });

    // 管理者に通知
    const empName = `${edit.employee.lastName} ${edit.employee.firstName}`;
    const dateStr = edit.workDate.toISOString().split('T')[0];
    await this.notifications.notifyAdmins(
      `勤怠修正への異議: ${empName}`,
      `${empName}（${edit.employee.employeeCode}）が ${dateStr} の勤怠修正に異議を申し立てました。\n理由: ${reason}`,
    );

    return { success: true };
  }

  /**
   * 管理者用: 指定社員の指定月の修正履歴一覧
   */
  async getAdminEdits(employeeId: string, year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    return this.db.adminAttendanceEdit.findMany({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 社員用: 自分の指定月の修正履歴一覧
   */
  async getMyAdminEdits(employeeId: string, year: number, month: number) {
    return this.getAdminEdits(employeeId, year, month);
  }

  /**
   * 全社員の勤怠修正ログ（設定ページ操作ログ用）
   */
  async getAllAdminEdits(limit = 50, offset = 0) {
    const [items, total] = await Promise.all([
      this.db.adminAttendanceEdit.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          employee: { select: { lastName: true, firstName: true } },
          adminUser: { select: { employee: { select: { lastName: true, firstName: true } } } },
        },
      }),
      this.db.adminAttendanceEdit.count(),
    ]);
    return { items, total };
  }

  // ============================================================
  // 社内勤怠一覧（アサインなし社員の勤怠）
  // ============================================================

  /**
   * アサインがない社員（待機中 employee + manager + member）の勤怠一覧
   */
  async getInternalAttendance(year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    // 在籍社員を全取得
    const employees = await this.db.employee.findMany({
      where: { status: 'active', deletedAt: null },
      include: {
        user: { select: { role: true } },
        department: { select: { name: true } },
        assignments: {
          where: {
            status: 'active',
            deletedAt: null,
            startDate: { lte: endDate },
            OR: [
              { endDate: null },
              { endDate: { gte: startDate } },
            ],
          },
          take: 1,
        },
      },
    });

    // admin を除外（勤怠免除）、アクティブアサインがある社員を除外
    const internalEmployees = employees.filter(
      (e) => e.user?.role !== 'admin' && e.assignments.length === 0,
    );

    // 対象社員の当月勤怠を取得
    const attendances = await this.db.attendance.findMany({
      where: {
        employeeId: { in: internalEmployees.map((e) => e.id) },
        workDate: { gte: startDate, lte: endDate },
      },
    });

    // 社員ごとに集計
    const attendanceByEmployee = new Map<string, typeof attendances>();
    for (const a of attendances) {
      const list = attendanceByEmployee.get(a.employeeId) || [];
      list.push(a);
      attendanceByEmployee.set(a.employeeId, list);
    }

    return internalEmployees.map((e) => {
      const records = attendanceByEmployee.get(e.id) || [];
      const workDays = records.filter((r) => r.clockIn !== null).length;
      const totalOvertimeMinutes = records.reduce(
        (sum, r) => sum + (r.overtimeMinutes || 0),
        0,
      );
      const hasMissedClock = records.some(
        (r) => r.clockIn !== null && r.clockOut === null,
      );

      const isConfirmed = records.length > 0 && records.every(
        (r) => r.status === 'confirmed',
      );

      return {
        employeeId: e.id,
        employeeCode: e.employeeCode,
        name: `${e.lastName} ${e.firstName}`,
        departmentName: e.department?.name || '',
        role: e.user?.role || 'employee',
        workDays,
        totalOvertimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
        hasMissedClock,
        hasAttendance: records.length > 0,
        isConfirmed,
      };
    });
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
