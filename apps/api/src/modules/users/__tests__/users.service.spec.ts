/**
 * UsersService 単体テスト（E: 権限・ロール定義）
 *
 * DatabaseService（Prisma）と AuditService をモックし、
 * ロール変更ロジック・最後の admin 保護・監査ログ記録を検証する。
 *
 * 重要ケース:
 * - 許容外ロール → BadRequestException
 * - 存在しない User → NotFoundException
 * - 退職済み社員のロール変更 → BadRequestException
 * - 最後の admin を降格 → BadRequestException（セルフ降格も含む）
 * - admin 数が 2 以上のときは降格 OK
 * - 同じロールへの変更は no-op（DB 更新も監査ログも呼ばない）
 * - 成功時は AuditService.log('user.role_change') が呼ばれる
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { DatabaseService } from '../../../database/database.service';
import { AuditService } from '../../audit-logs/audit.service';

/* ====== モック定義 ====== */

function createMockDb() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
}

function createMockAudit() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  };
}

const mockTargetUser = {
  id: 'target-user-id',
  role: 'member',
  employee: {
    id: 'target-employee-id',
    deletedAt: null,
    lastName: '鈴木',
    firstName: '花子',
    employeeCode: 'EMP-T02',
  },
};

const mockAdminTargetUser = {
  id: 'admin-user-id',
  role: 'admin',
  employee: {
    id: 'admin-employee-id',
    deletedAt: null,
    lastName: '山本',
    firstName: '浩二',
    employeeCode: 'EMP-001',
  },
};

/* ====== テストスイート ====== */

describe('UsersService', () => {
  let service: UsersService;
  let db: ReturnType<typeof createMockDb>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(async () => {
    db = createMockDb();
    audit = createMockAudit();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DatabaseService, useValue: db },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  /* ============================
   * changeRole: 入力バリデーション
   * ============================ */
  describe('changeRole - validation', () => {
    it('許容外ロールは BadRequestException', async () => {
      await expect(
        service.changeRole('target-user-id', 'super-admin', 'actor-id'),
      ).rejects.toThrow(BadRequestException);
      expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it('空文字ロールは BadRequestException', async () => {
      await expect(
        service.changeRole('target-user-id', '', 'actor-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('存在しないユーザーは NotFoundException', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.changeRole('nonexistent-id', 'manager', 'actor-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('削除済み社員のロール変更は BadRequestException', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        ...mockTargetUser,
        employee: { ...mockTargetUser.employee, deletedAt: new Date() },
      });
      await expect(
        service.changeRole('target-user-id', 'manager', 'actor-id'),
      ).rejects.toThrow(BadRequestException);
      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  /* ============================
   * changeRole: 正常系
   * ============================ */
  describe('changeRole - success cases', () => {
    it('member → manager への昇格が成功する', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockTargetUser);
      db.user.update.mockResolvedValueOnce({
        ...mockTargetUser,
        role: 'manager',
      });

      const result = await service.changeRole(
        'target-user-id',
        'manager',
        'actor-id',
      );

      expect(result).toEqual({ id: 'target-user-id', role: 'manager' });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'target-user-id' },
        data: { role: 'manager' },
      });
    });

    it('成功時に AuditService.log が user.role_change で呼ばれる', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockTargetUser);
      db.user.update.mockResolvedValueOnce({
        ...mockTargetUser,
        role: 'manager',
      });

      await service.changeRole('target-user-id', 'manager', 'actor-id');

      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith({
        userId: 'actor-id',
        action: 'user.role_change',
        targetTable: 'users',
        targetId: 'target-user-id',
        oldValue: { role: 'member' },
        newValue: { role: 'manager' },
      });
    });

    it('同じロールへの変更は DB 更新も監査ログも呼ばない（no-op）', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockTargetUser);

      const result = await service.changeRole(
        'target-user-id',
        'member',
        'actor-id',
      );

      expect(result).toEqual({ id: 'target-user-id', role: 'member' });
      expect(db.user.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('admin → manager への降格は、他に admin が居れば成功する（count=2）', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockAdminTargetUser);
      db.user.count.mockResolvedValueOnce(2);
      db.user.update.mockResolvedValueOnce({
        ...mockAdminTargetUser,
        role: 'manager',
      });

      const result = await service.changeRole(
        'admin-user-id',
        'manager',
        'other-admin-id',
      );

      expect(result.role).toBe('manager');
      expect(db.user.count).toHaveBeenCalledWith({
        where: { role: 'admin', employee: { deletedAt: null } },
      });
      expect(audit.log).toHaveBeenCalled();
    });

    it('employee → admin への昇格（admin 数の count チェックは発動しない）', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        ...mockTargetUser,
        role: 'employee',
      });
      db.user.update.mockResolvedValueOnce({
        ...mockTargetUser,
        role: 'admin',
      });

      await service.changeRole('target-user-id', 'admin', 'actor-id');

      // admin → 非admin のときだけ count が呼ばれる。昇格時は呼ばれない
      expect(db.user.count).not.toHaveBeenCalled();
      expect(db.user.update).toHaveBeenCalled();
    });
  });

  /* ============================
   * changeRole: 最後の admin 保護
   * ============================ */
  describe('changeRole - last admin protection', () => {
    it('admin 数 = 1 の状態で admin → manager は拒否', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockAdminTargetUser);
      db.user.count.mockResolvedValueOnce(1);

      await expect(
        service.changeRole('admin-user-id', 'manager', 'admin-user-id'),
      ).rejects.toThrow(/最後のadminを降格することはできません/);
      expect(db.user.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('admin 数 = 1 の状態で admin → member は拒否', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockAdminTargetUser);
      db.user.count.mockResolvedValueOnce(1);

      await expect(
        service.changeRole('admin-user-id', 'member', 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('admin 数 = 1 の状態で admin → employee は拒否', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockAdminTargetUser);
      db.user.count.mockResolvedValueOnce(1);

      await expect(
        service.changeRole('admin-user-id', 'employee', 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('セルフ降格（actorUserId === targetUserId）でも最後の admin 保護が発動', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockAdminTargetUser);
      db.user.count.mockResolvedValueOnce(1);

      // admin-user-id が自分自身を降格しようとする
      await expect(
        service.changeRole('admin-user-id', 'manager', 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('admin 数 = 0 という異常状態でも降格を拒否', async () => {
      db.user.findUnique.mockResolvedValueOnce(mockAdminTargetUser);
      db.user.count.mockResolvedValueOnce(0);

      await expect(
        service.changeRole('admin-user-id', 'manager', 'admin-user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ============================
   * isLastAdmin ヘルパー
   * ============================ */
  describe('isLastAdmin', () => {
    it('admin ロールで admin 数 = 1 なら true', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        role: 'admin',
        employee: { deletedAt: null },
      });
      db.user.count.mockResolvedValueOnce(1);

      await expect(service.isLastAdmin('admin-user-id')).resolves.toBe(true);
    });

    it('admin ロールで admin 数 = 2 なら false', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        role: 'admin',
        employee: { deletedAt: null },
      });
      db.user.count.mockResolvedValueOnce(2);

      await expect(service.isLastAdmin('admin-user-id')).resolves.toBe(false);
    });

    it('admin ロールでないユーザーは false', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        role: 'manager',
        employee: { deletedAt: null },
      });

      await expect(service.isLastAdmin('some-user-id')).resolves.toBe(false);
      expect(db.user.count).not.toHaveBeenCalled();
    });

    it('削除済み社員は false（admin 扱いしない）', async () => {
      db.user.findUnique.mockResolvedValueOnce({
        role: 'admin',
        employee: { deletedAt: new Date() },
      });

      await expect(service.isLastAdmin('admin-user-id')).resolves.toBe(false);
    });

    it('存在しないユーザーは false', async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.isLastAdmin('nonexistent-id')).resolves.toBe(false);
    });
  });
});
