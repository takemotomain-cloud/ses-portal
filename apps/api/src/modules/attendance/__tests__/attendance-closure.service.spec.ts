/**
 * 月次勤怠確定（AttendanceMonthlyClosure）のテスト
 *
 * getClosureStatus / closeMonth / reopenMonth / 確定後修正フック を検証。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttendanceService } from '../attendance.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';

/* ====== モック定義 ====== */

function createMockDb() {
  return {
    attendance: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    attendanceMonthlyClosure: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    attendanceCorrection: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    monthlyShift: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const mockNotifications = {
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
  create: jest.fn().mockResolvedValue(undefined),
};

/* ====== テストスイート ====== */

describe('AttendanceService — 月次勤怠確定', () => {
  let service: AttendanceService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    db = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  /* ==========================
   * getClosureStatus
   * ========================== */
  describe('getClosureStatus', () => {
    it('確定済みの月はstatus=closedを返す', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue({
        yearMonth: '2026-04',
        status: 'closed',
        closedAt: new Date(),
        hasPostCloseChanges: false,
      });
      db.employee.findMany.mockResolvedValue([]);

      const result = await service.getClosureStatus(2026, 4);
      expect(result.status).toBe('closed');
      expect(result.yearMonth).toBe('2026-04');
    });

    it('未確定の月はstatus=openを返す', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);
      db.employee.findMany.mockResolvedValue([]);

      const result = await service.getClosureStatus(2026, 4);
      expect(result.status).toBe('open');
    });

    it('admin社員は勤怠免除として exemptCount に含まれる', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-1', lastName: '山田', firstName: '太郎', employeeCode: 'EMP-001', user: { role: 'admin' }, department: { name: '管理部' } },
        { id: 'emp-2', lastName: '佐藤', firstName: '花子', employeeCode: 'EMP-002', user: { role: 'employee' }, department: { name: 'SES事業部' } },
      ]);
      // emp-2 has attendance
      db.attendance.groupBy.mockResolvedValue([{ employeeId: 'emp-2', _count: 20 }]);

      const result = await service.getClosureStatus(2026, 4);
      expect(result.readiness.exemptCount).toBe(1); // admin
      expect(result.readiness.confirmedCount).toBe(1); // emp-2
      expect(result.readiness.unconfirmedEmployees).toHaveLength(0);
    });

    it('勤怠未入力の社員がunconfirmedEmployeesに含まれる', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-1', lastName: '田中', firstName: '太郎', employeeCode: 'EMP-001', user: { role: 'employee' }, department: { name: 'SES事業部' } },
        { id: 'emp-2', lastName: '佐藤', firstName: '花子', employeeCode: 'EMP-002', user: { role: 'employee' }, department: { name: '管理部' } },
      ]);
      // Only emp-1 has attendance
      db.attendance.groupBy.mockResolvedValue([{ employeeId: 'emp-1', _count: 20 }]);

      const result = await service.getClosureStatus(2026, 4);
      expect(result.readiness.unconfirmedEmployees).toHaveLength(1);
      expect(result.readiness.unconfirmedEmployees[0].employeeCode).toBe('EMP-002');
    });
  });

  /* ==========================
   * closeMonth
   * ========================== */
  describe('closeMonth', () => {
    it('全社員確定済み → 月次確定成功', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);
      // getClosureStatus 呼び出し用
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-1', lastName: '田中', firstName: '太郎', employeeCode: 'EMP-001', user: { role: 'employee' }, department: { name: 'SES事業部' } },
      ]);
      db.attendance.groupBy.mockResolvedValue([{ employeeId: 'emp-1', _count: 20 }]);
      db.attendanceMonthlyClosure.upsert.mockResolvedValue({});

      const result = await service.closeMonth(2026, 4, 'admin-emp-id');
      expect(result.status).toBe('closed');
      expect(db.attendanceMonthlyClosure.upsert).toHaveBeenCalled();
    });

    it('未確定社員あり → BadRequestException', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-1', lastName: '田中', firstName: '太郎', employeeCode: 'EMP-001', user: { role: 'employee' }, department: { name: 'SES事業部' } },
      ]);
      db.attendance.groupBy.mockResolvedValue([]); // 勤怠なし

      await expect(
        service.closeMonth(2026, 4, 'admin-emp-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('admin社員に勤怠なし → 免除されて確定成功', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-admin', lastName: '社長', firstName: '太郎', employeeCode: 'EMP-000', user: { role: 'admin' }, department: { name: '管理部' } },
      ]);
      db.attendance.groupBy.mockResolvedValue([]); // admin は勤怠なしでも OK
      db.attendanceMonthlyClosure.upsert.mockResolvedValue({});

      const result = await service.closeMonth(2026, 4, 'emp-admin');
      expect(result.status).toBe('closed');
    });

    it('既に確定済み → BadRequestException', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue({
        yearMonth: '2026-04',
        status: 'closed',
      });

      await expect(
        service.closeMonth(2026, 4, 'admin-emp-id'),
      ).rejects.toThrow('既に確定されています');
    });
  });

  /* ==========================
   * reopenMonth
   * ========================== */
  describe('reopenMonth', () => {
    it('確定解除 → status=open に戻る', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue({
        yearMonth: '2026-04',
        status: 'closed',
      });
      db.attendanceMonthlyClosure.update.mockResolvedValue({});

      const result = await service.reopenMonth(2026, 4, 'admin-emp-id');
      expect(result.status).toBe('open');
    });

    it('未確定の月を解除しようとすると BadRequestException', async () => {
      db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);

      await expect(
        service.reopenMonth(2026, 4, 'admin-emp-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
