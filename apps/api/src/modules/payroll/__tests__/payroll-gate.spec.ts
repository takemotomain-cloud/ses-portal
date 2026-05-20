/**
 * 給与計算ゲート（勤怠確定チェック）のテスト
 *
 * calculateMonthly が勤怠確定済みかを事前チェックすることを検証。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PayrollService } from '../payroll.service';
import { DatabaseService } from '../../../database/database.service';
import { AuditService } from '../../audit-logs/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PayslipPdfService } from '../payslip-pdf.service';

/* ====== モック定義 ====== */

function createMockDb(): any {
  return {
    attendanceMonthlyClosure: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    rateMaster: {
      upsert: jest.fn().mockResolvedValue({
        healthInsurance: 0.05,
        employeePension: 0.0915,
        employmentInsurance: 0.006,
        incomeTax: 0.033,
        residentTaxFixed: 18000,
      }),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    payroll: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    attendance: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    expenseItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    dependent: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };
}

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

/* ====== テストスイート ====== */

describe('PayrollService — 給与計算ゲート', () => {
  let service: PayrollService;
  let db: any;

  beforeEach(async () => {
    db = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: DatabaseService, useValue: db },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PayslipPdfService,
          useValue: { generate: jest.fn().mockResolvedValue(Buffer.from('')) },
        },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  it('closure なし → calculateMonthly が BadRequestException', async () => {
    db.attendanceMonthlyClosure.findUnique.mockResolvedValue(null);

    await expect(
      service.calculateMonthly('test-tenant-id', 2026, 4),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.calculateMonthly('test-tenant-id', 2026, 4),
    ).rejects.toThrow('勤怠が確定されていません');
  });

  it('closure status=open → calculateMonthly が BadRequestException', async () => {
    db.attendanceMonthlyClosure.findUnique.mockResolvedValue({
      yearMonth: '2026-04',
      status: 'open',
    });

    await expect(
      service.calculateMonthly('test-tenant-id', 2026, 4),
    ).rejects.toThrow(BadRequestException);
  });

  it('closure status=closed → calculateMonthly が成功（ゲート通過）', async () => {
    db.attendanceMonthlyClosure.findUnique.mockResolvedValue({
      yearMonth: '2026-04',
      status: 'closed',
    });

    const result = await service.calculateMonthly('test-tenant-id', 2026, 4);
    expect(result.processedCount).toBe(0); // 社員がいないので0
    expect(result.targetMonth).toBe('2026-04');
  });

  it('getClosureStatus: 確定済み月は isClosed=true を返す', async () => {
    db.attendanceMonthlyClosure.findFirst.mockResolvedValue({
      yearMonth: '2026-04',
      status: 'closed',
      closedAt: new Date('2026-04-10'),
      hasPostCloseChanges: false,
    });

    const result = await service.getClosureStatus('test-tenant-id', 2026, 4);
    expect(result.isClosed).toBe(true);
    expect(result.hasPostCloseChanges).toBe(false);
  });

  it('getClosureStatus: 未確定月は isClosed=false を返す', async () => {
    db.attendanceMonthlyClosure.findFirst.mockResolvedValue(null);
    // 従業員を1人追加して allConfirmed を false にする
    db.employee.findMany.mockResolvedValue([
      { id: 'emp-1', assignments: [{ id: 'as-1' }] },
    ]);
    db.attendance.count.mockResolvedValue(1); // 1件未確定

    const result = await service.getClosureStatus('test-tenant-id', 2026, 4);
    expect(result.isClosed).toBe(false);
  });
});
