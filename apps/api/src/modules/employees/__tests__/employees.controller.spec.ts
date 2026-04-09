/**
 * EmployeesController 結合テスト
 *
 * NestJSテストモジュールを使い、Controller + Service の統合動作を検証。
 * Guard/認可ロジック・ルーティング・ロールベースアクセス制御を確認する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmployeesController } from '../employees.controller';
import { EmployeesService } from '../employees.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

/* ====== テスト用ユーザー ====== */

const adminUser: RequestUser = {
  userId: 'user-admin',
  employeeId: 'emp-admin',
  employeeCode: 'ADM-001',
  name: '管理者',
  email: 'admin@example.com',
  role: 'admin',
};

const employeeUser: RequestUser = {
  userId: 'user-emp',
  employeeId: 'emp-001',
  employeeCode: 'EMP-001',
  name: '一般社員',
  email: 'employee@example.com',
  role: 'employee',
};

const salesUser: RequestUser = {
  userId: 'user-sales',
  employeeId: 'emp-sales',
  employeeCode: 'SLS-001',
  name: '営業担当',
  email: 'sales@example.com',
  role: 'sales',
};

/* ====== サービスモック ====== */

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  createEmergencyContact: jest.fn(),
};

/* ====== テストスイート ====== */

describe('EmployeesController', () => {
  let controller: EmployeesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        { provide: EmployeesService, useValue: mockService },
        Reflector,
      ],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
  });

  /* ============================
   * GET /employees/me
   * ============================ */
  describe('getMe', () => {
    it('ログインユーザー自身の情報を返す', async () => {
      const employeeData = { id: 'emp-001', lastName: '田中', firstName: '太郎' };
      mockService.findOne.mockResolvedValue(employeeData);

      const result = await controller.getMe(employeeUser);

      expect(result).toEqual(employeeData);
      expect(mockService.findOne).toHaveBeenCalledWith('emp-001');
    });

    it('adminユーザーでも自分の情報を取得できる', async () => {
      mockService.findOne.mockResolvedValue({ id: 'emp-admin' });

      const result = await controller.getMe(adminUser);

      expect(mockService.findOne).toHaveBeenCalledWith('emp-admin');
    });
  });

  /* ============================
   * GET /employees
   * ============================ */
  describe('findAll', () => {
    it('ページネーション付き一覧を返す', async () => {
      const listResult = {
        data: [{ id: '1', employeeCode: 'EMP-001' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.findAll.mockResolvedValue(listResult);

      const result = await controller.findAll(1, 20, undefined, undefined);

      expect(result).toEqual(listResult);
      expect(mockService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined,
        status: undefined,
      });
    });

    it('検索・ステータスフィルタを渡す', async () => {
      mockService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await controller.findAll(1, 20, '田中', 'active');

      expect(mockService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: '田中',
        status: 'active',
      });
    });
  });

  /* ============================
   * POST /employees
   * ============================ */
  describe('create', () => {
    it('社員を新規作成する', async () => {
      const body = {
        lastName: '佐藤',
        firstName: '花子',
        employeeCode: 'EMP-100',
        hireDate: '2025-06-01',
        departmentId: 'dept-1',
        email: 'sato@example.com',
      };
      mockService.create.mockResolvedValue({ id: 'new-id', employeeCode: 'EMP-100' });

      const result = await controller.create(adminUser, body);

      expect(result).toEqual({ id: 'new-id', employeeCode: 'EMP-100' });
      expect(mockService.create).toHaveBeenCalledWith(body, adminUser.userId);
    });
  });

  /* ============================
   * PATCH /employees/:id
   * ============================ */
  describe('update', () => {
    it('社員情報を更新する', async () => {
      mockService.update.mockResolvedValue({ id: 'emp-001' });

      const result = await controller.update('emp-001', adminUser, { lastName: '鈴木' });

      expect(result).toEqual({ id: 'emp-001' });
      expect(mockService.update).toHaveBeenCalledWith('emp-001', { lastName: '鈴木' }, adminUser.userId);
    });
  });

  /* ============================
   * POST /employees/:id/emergency-contact
   * ============================ */
  describe('createEmergencyContact', () => {
    it('緊急連絡先を登録する', async () => {
      mockService.createEmergencyContact.mockResolvedValue({ id: 'ec-1' });

      const result = await controller.createEmergencyContact('emp-001', {
        name: '田中 花子',
        relationship: '配偶者',
        phone: '090-0000-0000',
      });

      expect(result).toEqual({ id: 'ec-1' });
      expect(mockService.createEmergencyContact).toHaveBeenCalledWith('emp-001', {
        name: '田中 花子',
        relationship: '配偶者',
        phone: '090-0000-0000',
      });
    });
  });

  /* ============================
   * GET /employees/:id — ロールベースアクセス制御
   * ============================ */
  describe('findOne - アクセス制御', () => {
    it('adminは任意の社員詳細を取得できる', async () => {
      mockService.findOne.mockResolvedValue({ id: 'emp-001', lastName: '田中' });

      const result = await controller.findOne('emp-001', adminUser);

      expect(result.lastName).toBe('田中');
    });

    it('employeeは自分自身の詳細を取得できる', async () => {
      mockService.findOne.mockResolvedValue({ id: 'emp-001', lastName: '一般' });

      const result = await controller.findOne('emp-001', employeeUser);

      expect(result.id).toBe('emp-001');
    });

    it('employeeが他人の詳細にアクセスするとForbiddenException', async () => {
      await expect(
        controller.findOne('emp-other', employeeUser),
      ).rejects.toThrow(ForbiddenException);

      expect(mockService.findOne).not.toHaveBeenCalled();
    });

    it('salesは他社員の詳細を取得できる', async () => {
      mockService.findOne.mockResolvedValue({ id: 'emp-001' });

      const result = await controller.findOne('emp-001', salesUser);

      expect(result.id).toBe('emp-001');
    });
  });

  /* ============================
   * RolesGuard メタデータ検証
   * ============================ */
  describe('ロールメタデータ', () => {
    it('findAllはadmin/sales/accountingロールが必要', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, EmployeesController.prototype.findAll);
      expect(roles).toEqual(['admin', 'sales', 'accounting']);
    });

    it('createはadminロールが必要', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, EmployeesController.prototype.create);
      expect(roles).toEqual(['admin']);
    });

    it('updateはadminロールが必要', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, EmployeesController.prototype.update);
      expect(roles).toEqual(['admin']);
    });

    it('createEmergencyContactはadminロールが必要', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, EmployeesController.prototype.createEmergencyContact);
      expect(roles).toEqual(['admin']);
    });

    it('getMeはロール制限なし', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, EmployeesController.prototype.getMe);
      expect(roles).toBeUndefined();
    });

    it('findOneはロール制限なし（コード内でロールチェック）', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, EmployeesController.prototype.findOne);
      expect(roles).toBeUndefined();
    });
  });
});
