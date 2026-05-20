/**
 * AttendanceService 単体テスト
 *
 * 勤怠修正申請のビジネスロジックを検証する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttendanceService } from '../attendance.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { GoogleDriveService } from '../../google-drive/google-drive.service';

/* ====== モック定義 ====== */

const TENANT_ID = 'test-tenant-id';

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

function createMockDb(): any {
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
    attendanceMonthlyClosure: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

/* ====== テストスイート ====== */

describe('AttendanceService', () => {
  let service: AttendanceService;
  let db: any;

  beforeEach(async () => {
    db = createMockDb();
    db.$transaction = jest.fn(async (cb: any) => cb(db));

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
        {
          provide: GoogleDriveService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
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
      db.attendanceCorrection.findFirst.mockResolvedValue(null);
      db.attendanceCorrection.create.mockResolvedValue({ id: 'corr-1' });

      const result = await service.createCorrection('att-1', 'emp-1', {
        reason: '打刻忘れ',
        newClockIn: '09:00',
        newClockOut: '18:00',
      }, TENANT_ID);

      expect(result).toEqual({ id: 'corr-1' });
      expect(db.attendanceCorrection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attendanceId: 'att-1',
          employeeId: 'emp-1',
          tenantId: TENANT_ID,
          reason: '打刻忘れ',
        }),
      });
    });

    it('重複した未処理申請がある場合はBadRequestException', async () => {
      db.attendance.findFirst.mockResolvedValue(mockAttendance);
      db.attendanceCorrection.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createCorrection('att-1', 'emp-1', { reason: 'test' }, TENANT_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ============================
   * approveCorrection
   * ============================ */
  describe('approveCorrection', () => {
    const mockCorrection = {
      id: 'corr-1',
      attendanceId: 'att-1',
      employeeId: 'emp-1',
      newClockIn: new Date('2026-04-01T10:00:00Z'),
      newClockOut: new Date('2026-04-01T19:00:00Z'),
      newBreakMinutes: 60,
      attendance: mockAttendance,
    };

    it('修正申請を承認し、勤怠を更新する', async () => {
      db.attendanceCorrection.findFirst.mockResolvedValue(mockCorrection);
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);

      await service.approveCorrection('corr-1', 'admin-1', TENANT_ID);

      expect(db.attendanceCorrection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'corr-1' },
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );
      expect(db.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({
            clockIn: mockCorrection.newClockIn,
            clockOut: mockCorrection.newClockOut,
          }),
        }),
      );
    });
  });

  /* ============================
   * rejectCorrection
   * ============================ */
  describe('rejectCorrection', () => {
    it('修正申請を却下する', async () => {
      db.attendanceCorrection.findFirst.mockResolvedValue({ id: 'corr-1' });

      await service.rejectCorrection('corr-1', 'admin-1', TENANT_ID, '理由');

      expect(db.attendanceCorrection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'corr-1' },
          data: expect.objectContaining({
            status: 'rejected',
            rejectReason: '理由',
          }),
        }),
      );
    });
  });
});
