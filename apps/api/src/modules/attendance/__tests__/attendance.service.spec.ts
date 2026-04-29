/**
 * AttendanceService 単体テスト
 *
 * 勤怠修正申請のビジネスロジックを検証する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AttendanceService } from '../attendance.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';

/* ====== モック定義 ====== */

const mockAttendance = {
  id: 'att-1',
  employeeId: 'emp-1',
  workDate: new Date('2026-04-01'),
  clockIn: new Date('2026-04-01T09:00:00Z'),
  clockOut: new Date('2026-04-01T18:00:00Z'),
  breakMinutes: 60,
  workMinutes: 480,
  overtimeMinutes: 0,
  status: 'normal',
  isMissedClock: false,
};

function createMockDb() {
  return {
    attendance: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attendanceCorrection: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

/* ====== テストスイート ====== */

describe('AttendanceService', () => {
  let service: AttendanceService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    db = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: DatabaseService, useValue: db },
        {
          provide: NotificationsService,
          useValue: {
            notifyAdmins: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  /* ============================
   * createCorrection
   * ============================ */
  describe('createCorrection', () => {
    it('修正申請を作成する', async () => {
      db.attendance.findFirst.mockResolvedValue(mockAttendance);
      db.attendanceCorrection.findFirst.mockResolvedValue(null); // 未処理なし
      db.attendanceCorrection.create.mockResolvedValue({ id: 'corr-1' });

      const result = await service.createCorrection('att-1', 'emp-1', {
        newClockIn: '2026-04-01T08:30:00Z',
        reason: '打刻ミス',
      });

      expect(result).toEqual({ id: 'corr-1' });
      expect(db.attendanceCorrection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attendanceId: 'att-1',
          employeeId: 'emp-1',
          originalClockIn: mockAttendance.clockIn,
          originalClockOut: mockAttendance.clockOut,
          originalBreakMinutes: mockAttendance.breakMinutes,
          newClockIn: new Date('2026-04-01T08:30:00Z'),
          reason: '打刻ミス',
        }),
      });
    });

    it('存在しない勤怠レコードでNotFoundExceptionを投げる', async () => {
      db.attendance.findFirst.mockResolvedValue(null);

      await expect(
        service.createCorrection('nonexistent', 'emp-1', {
          newClockIn: '2026-04-01T08:30:00Z',
          reason: 'テスト',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('他人の勤怠レコードではNotFoundExceptionを投げる', async () => {
      db.attendance.findFirst.mockResolvedValue(null); // employeeIdが一致しない

      await expect(
        service.createCorrection('att-1', 'emp-other', {
          newClockIn: '2026-04-01T08:30:00Z',
          reason: 'テスト',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('既に未処理の申請がある場合はBadRequestException', async () => {
      db.attendance.findFirst.mockResolvedValue(mockAttendance);
      db.attendanceCorrection.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createCorrection('att-1', 'emp-1', {
          newClockIn: '2026-04-01T08:30:00Z',
          reason: 'テスト',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('修正項目がない場合はBadRequestException', async () => {
      db.attendance.findFirst.mockResolvedValue(mockAttendance);
      db.attendanceCorrection.findFirst.mockResolvedValue(null);

      await expect(
        service.createCorrection('att-1', 'emp-1', {
          reason: 'テスト',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('休憩時間が範囲外の場合はBadRequestException', async () => {
      db.attendance.findFirst.mockResolvedValue(mockAttendance);
      db.attendanceCorrection.findFirst.mockResolvedValue(null);

      await expect(
        service.createCorrection('att-1', 'emp-1', {
          newBreakMinutes: 500,
          reason: 'テスト',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ============================
   * getMyCorrections
   * ============================ */
  describe('getMyCorrections', () => {
    it('自分の修正申請一覧を返す', async () => {
      const corrections = [
        { id: 'corr-1', status: 'pending', attendance: { workDate: '2026-04-01' } },
        { id: 'corr-2', status: 'approved', attendance: { workDate: '2026-03-28' } },
      ];
      db.attendanceCorrection.findMany.mockResolvedValue(corrections);

      const result = await service.getMyCorrections('emp-1');

      expect(result).toHaveLength(2);
      expect(db.attendanceCorrection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId: 'emp-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  /* ============================
   * getPendingCorrections
   * ============================ */
  describe('getPendingCorrections', () => {
    it('未処理の修正申請を返す', async () => {
      db.attendanceCorrection.findMany.mockResolvedValue([]);

      await service.getPendingCorrections();

      expect(db.attendanceCorrection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
          include: expect.objectContaining({
            employee: expect.any(Object),
            attendance: expect.any(Object),
          }),
        }),
      );
    });
  });

  /* ============================
   * approveCorrection
   * ============================ */
  describe('approveCorrection', () => {
    it('修正を承認し勤怠レコードに反映する', async () => {
      const correction = {
        id: 'corr-1',
        attendanceId: 'att-1',
        newClockIn: new Date('2026-04-01T08:30:00Z'),
        newClockOut: null,
        newBreakMinutes: null,
        attendance: mockAttendance,
      };

      db.attendanceCorrection.findFirst.mockResolvedValue(correction);

      const txMock = {
        attendanceCorrection: { update: jest.fn() },
        attendance: { update: jest.fn() },
        attendanceMonthlyClosure: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      };
      db.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await service.approveCorrection('corr-1', 'admin-1');

      // 申請ステータス更新
      expect(txMock.attendanceCorrection.update).toHaveBeenCalledWith({
        where: { id: 'corr-1' },
        data: expect.objectContaining({
          status: 'approved',
          approverId: 'admin-1',
          approvedAt: expect.any(Date),
        }),
      });

      // 勤怠レコード更新
      expect(txMock.attendance.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: expect.objectContaining({
          clockIn: new Date('2026-04-01T08:30:00Z'),
          clockOut: mockAttendance.clockOut,
          breakMinutes: mockAttendance.breakMinutes,
        }),
      });
    });

    it('存在しない修正申請でNotFoundExceptionを投げる', async () => {
      db.attendanceCorrection.findFirst.mockResolvedValue(null);

      await expect(
        service.approveCorrection('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ============================
   * rejectCorrection
   * ============================ */
  describe('rejectCorrection', () => {
    it('修正申請を却下する', async () => {
      db.attendanceCorrection.findFirst.mockResolvedValue({ id: 'corr-1', status: 'pending' });
      db.attendanceCorrection.update.mockResolvedValue({});

      await service.rejectCorrection('corr-1', 'admin-1', '内容不備');

      expect(db.attendanceCorrection.update).toHaveBeenCalledWith({
        where: { id: 'corr-1' },
        data: expect.objectContaining({
          status: 'rejected',
          approverId: 'admin-1',
          rejectReason: '内容不備',
        }),
      });
    });

    it('存在しない修正申請でNotFoundExceptionを投げる', async () => {
      db.attendanceCorrection.findFirst.mockResolvedValue(null);

      await expect(
        service.rejectCorrection('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ============================
   * clockIn / clockOut / updateBreak の基本テスト
   * ============================ */
  describe('clockIn', () => {
    it('出勤打刻を記録する', async () => {
      db.attendance.findUnique.mockResolvedValue(null);
      db.attendance.create.mockResolvedValue({ id: 'att-new' });

      const result = await service.clockIn('emp-1');

      expect(result.id).toBe('att-new');
    });

    it('既に打刻済みならBadRequestException', async () => {
      db.attendance.findUnique.mockResolvedValue({ clockIn: new Date() });

      await expect(service.clockIn('emp-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('clockOut', () => {
    it('出勤打刻がないとBadRequestException', async () => {
      db.attendance.findUnique.mockResolvedValue(null);

      await expect(service.clockOut('emp-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateBreak', () => {
    it('休憩時間が範囲外だとBadRequestException', async () => {
      await expect(service.updateBreak('att-1', 'emp-1', -1)).rejects.toThrow(BadRequestException);
      await expect(service.updateBreak('att-1', 'emp-1', 481)).rejects.toThrow(BadRequestException);
    });

    it('自分のレコードでなければNotFoundExceptionを投げる', async () => {
      db.attendance.findFirst.mockResolvedValue(null);

      await expect(service.updateBreak('att-1', 'emp-1', 45)).rejects.toThrow(NotFoundException);
    });
  });
});
