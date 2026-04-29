/**
 * EmployeesService 単体テスト
 *
 * DatabaseService（Prisma）をモックし、
 * ビジネスロジック・バリデーション・エラーハンドリングを検証する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeesService } from '../employees.service';
import { DatabaseService } from '../../../database/database.service';
import { LeaveService } from '../../leave/leave.service';
import { AuditService } from '../../audit-logs/audit.service';

/* ====== モック定義 ====== */

const mockEmployee = {
  id: '11111111-1111-1111-1111-111111111111',
  employeeCode: 'EMP-001',
  lastName: '田中',
  firstName: '太郎',
  lastNameKana: 'たなか',
  firstNameKana: 'たろう',
  email: 'tanaka@example.com',
  phone: '090-1234-5678',
  address: '東京都渋谷区',
  hireDate: new Date('2025-04-01'),
  birthDate: new Date('1995-01-15'),
  gender: 'male',
  status: 'active',
  employmentType: 'regular',
  contractType: 'indefinite',
  education: null,
  schoolName: null,
  baseSalary: 300000,
  rewardRate: 72,
  bankName: '三菱UFJ銀行',
  bankBranch: '梅田支店',
  bankAccountType: 'ordinary',
  bankAccountNumber: '1234567',
  myNumber: 'encrypted-my-number',
  departmentId: 'dept-1',
  positionId: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEmployeeWithRelations = {
  ...mockEmployee,
  department: { id: 'dept-1', name: '開発部', code: 'DEV' },
  position: null,
  emergencyContacts: [],
  dependents: [],
};

function createMockDb() {
  return {
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      create: jest.fn(),
      count: jest.fn(),
    },
    emergencyContact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    attendance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    department: {
      findFirst: jest.fn(),
    },
    position: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const mockLeaveService = {
  getBalance: jest.fn(),
  grantAnnualLeave: jest.fn().mockResolvedValue(undefined),
  grantInitialLeave: jest.fn().mockResolvedValue(undefined),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

/* ====== テストスイート ====== */

describe('EmployeesService', () => {
  let service: EmployeesService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    db = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: DatabaseService, useValue: db },
        { provide: LeaveService, useValue: mockLeaveService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  /* ============================
   * findAll
   * ============================ */
  describe('findAll', () => {
    it('デフォルトのページネーションで一覧を返す', async () => {
      const listItem = {
        id: mockEmployee.id,
        employeeCode: 'EMP-001',
        lastName: '田中',
        firstName: '太郎',
        status: 'active',
        employmentType: 'regular',
        contractType: 'indefinite',
        hireDate: new Date('2025-04-01'),
        department: { name: '開発部' },
        position: null,
      };

      db.employee.findMany.mockResolvedValue([listItem]);
      db.employee.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].employeeCode).toBe('EMP-001');
      expect(result.data[0].departmentName).toBe('開発部');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('ページネーションパラメータが反映される', async () => {
      db.employee.findMany.mockResolvedValue([]);
      db.employee.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10 });

      expect(db.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('limitがMAX_LIMITを超えない', async () => {
      db.employee.findMany.mockResolvedValue([]);
      db.employee.count.mockResolvedValue(0);

      await service.findAll({ limit: 999 });

      expect(db.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('検索パラメータでOR条件が追加される', async () => {
      db.employee.findMany.mockResolvedValue([]);
      db.employee.count.mockResolvedValue(0);

      await service.findAll({ search: '田中' });

      const call = db.employee.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(3);
      expect(call.where.OR[0]).toEqual({ lastName: { contains: '田中' } });
    });

    it('ステータスフィルタが適用される', async () => {
      db.employee.findMany.mockResolvedValue([]);
      db.employee.count.mockResolvedValue(0);

      await service.findAll({ status: 'leave' });

      const call = db.employee.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('leave');
    });

    it('deletedAt: null が常に適用される', async () => {
      db.employee.findMany.mockResolvedValue([]);
      db.employee.count.mockResolvedValue(0);

      await service.findAll({});

      const call = db.employee.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBeNull();
    });
  });

  /* ============================
   * findOne
   * ============================ */
  describe('findOne', () => {
    it('社員詳細を返す（myNumberは除外）', async () => {
      db.employee.findFirst.mockResolvedValue(mockEmployeeWithRelations);

      const result = await service.findOne(mockEmployee.id);

      expect(result.id).toBe(mockEmployee.id);
      expect(result.lastName).toBe('田中');
      expect(result.department).toEqual({ id: 'dept-1', name: '開発部', code: 'DEV' });
      expect((result as any).myNumber).toBeUndefined();
    });

    it('存在しない社員でNotFoundExceptionを投げる', async () => {
      db.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ============================
   * create
   * ============================ */
  describe('create', () => {
    const createData = {
      lastName: '佐藤',
      firstName: '花子',
      employeeCode: 'EMP-100',
      hireDate: '2025-06-01',
      departmentId: 'dept-1',
      email: 'sato@example.com',
    };

    it('社員とUserレコードを作成し、id/employeeCodeを返す', async () => {
      db.employee.findFirst.mockResolvedValue(null); // 重複なし
      db.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          employee: {
            create: jest.fn().mockResolvedValue({
              id: 'new-id',
              employeeCode: 'EMP-100',
              lastName: '佐藤',
              firstName: '花子',
            }),
          },
          user: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.create(createData);

      expect(result).toEqual({ id: 'new-id', employeeCode: 'EMP-100' });
    });

    it('メールアドレス重複でBadRequestExceptionを投げる', async () => {
      // メール重複チェックでヒット
      db.employee.findFirst.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create(createData)).rejects.toThrow(BadRequestException);
    });

    it('社員番号重複でBadRequestExceptionを投げる', async () => {
      // 1回目: メールチェック → なし, 2回目: 社員番号チェック → あり
      db.employee.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create(createData)).rejects.toThrow(BadRequestException);
    });
  });

  /* ============================
   * update
   * ============================ */
  describe('update', () => {
    it('社員情報を部分更新する', async () => {
      db.employee.findFirst.mockResolvedValue(mockEmployee);
      db.employee.update.mockResolvedValue({ ...mockEmployee, lastName: '鈴木' });

      const result = await service.update(mockEmployee.id, { lastName: '鈴木' });

      expect(result).toEqual({ id: mockEmployee.id });
      expect(db.employee.update).toHaveBeenCalledWith({
        where: { id: mockEmployee.id },
        data: { lastName: '鈴木' },
      });
    });

    it('存在しない社員でNotFoundExceptionを投げる', async () => {
      db.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { lastName: '鈴木' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('他社員とメール重複でBadRequestExceptionを投げる', async () => {
      db.employee.findFirst
        .mockResolvedValueOnce(mockEmployee) // 存在確認
        .mockResolvedValueOnce({ id: 'other-id' }); // メール重複

      await expect(
        service.update(mockEmployee.id, { email: 'taken@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('自分自身のメールは重複チェックをスキップする', async () => {
      db.employee.findFirst.mockResolvedValue(mockEmployee);
      db.employee.update.mockResolvedValue(mockEmployee);

      // 同じメールアドレスで更新 → 重複チェック不要
      await service.update(mockEmployee.id, { email: mockEmployee.email });

      // findFirstは1回のみ（存在確認）、メール重複チェックは呼ばれない
      expect(db.employee.findFirst).toHaveBeenCalledTimes(1);
    });

    it('birthDateはDate型に変換される', async () => {
      db.employee.findFirst.mockResolvedValue(mockEmployee);
      db.employee.update.mockResolvedValue(mockEmployee);

      await service.update(mockEmployee.id, { birthDate: '1995-06-15' });

      expect(db.employee.update).toHaveBeenCalledWith({
        where: { id: mockEmployee.id },
        data: { birthDate: new Date('1995-06-15') },
      });
    });
  });

  /* ============================
   * createEmergencyContact
   * ============================ */
  describe('createEmergencyContact', () => {
    it('緊急連絡先を登録する', async () => {
      db.employee.findFirst.mockResolvedValue(mockEmployee);
      db.emergencyContact.findFirst.mockResolvedValue(null); // 既存なし
      db.emergencyContact.create.mockResolvedValue({ id: 'ec-1' });

      const result = await service.createEmergencyContact(mockEmployee.id, {
        name: '田中 花子',
        relationship: '配偶者',
        phone: '090-0000-0000',
      });

      expect(result).toEqual({ id: 'ec-1' });
      expect(db.emergencyContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: mockEmployee.id,
          name: '田中 花子',
          relationship: '配偶者',
          phone: '090-0000-0000',
          sortOrder: 1,
        }),
      });
    });

    it('sortOrderが既存の最大値+1になる', async () => {
      db.employee.findFirst.mockResolvedValue(mockEmployee);
      db.emergencyContact.findFirst.mockResolvedValue({ sortOrder: 3 });
      db.emergencyContact.create.mockResolvedValue({ id: 'ec-2' });

      await service.createEmergencyContact(mockEmployee.id, {
        name: '田中 次郎',
        relationship: '父',
        phone: '090-1111-1111',
      });

      expect(db.emergencyContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 4 }),
      });
    });

    it('存在しない社員でNotFoundExceptionを投げる', async () => {
      db.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createEmergencyContact('nonexistent', {
          name: 'Test',
          relationship: '父',
          phone: '090-0000-0000',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
