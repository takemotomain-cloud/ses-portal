/**
 * UsersController 単体テスト（E: 権限・ロール定義）
 *
 * UsersService をモックし、PATCH /users/:id/role のコントローラー層の
 * delegation と応答形式を検証する。
 *
 * Guard レベルの admin 限定は roles.guard.spec.ts でカバー済みのため、
 * 本 spec では Controller が service.changeRole を正しく呼び、
 * 期待する形式のレスポンスを返すことだけを検証する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

/* ====== モック定義 ====== */

const mockUsersService = {
  changeRole: jest.fn(),
};

const adminUser: RequestUser = {
  userId: 'actor-admin-id',
  employeeId: 'emp-admin',
  employeeCode: 'EMP-001',
  name: '山本 浩二',
  email: 'k.yamamoto@example.com',
  role: 'admin',
};

/* ====== テストスイート ====== */

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  /* ============================
   * PATCH /users/:id/role
   * ============================ */
  describe('changeRole', () => {
    it('service.changeRole に (id, role, actorUserId) を渡して delegation する', async () => {
      mockUsersService.changeRole.mockResolvedValueOnce({
        id: 'target-user-id',
        role: 'manager',
      });

      const result = await controller.changeRole(
        'target-user-id',
        { role: 'manager' },
        adminUser,
      );

      expect(mockUsersService.changeRole).toHaveBeenCalledTimes(1);
      expect(mockUsersService.changeRole).toHaveBeenCalledWith(
        'target-user-id',
        'manager',
        'actor-admin-id',
      );
      expect(result).toEqual({
        id: 'target-user-id',
        role: 'manager',
        message: 'ロールを変更しました',
      });
    });

    it('service が返した id/role をそのままレスポンスに反映する', async () => {
      mockUsersService.changeRole.mockResolvedValueOnce({
        id: 'another-user-id',
        role: 'member',
      });

      const result = await controller.changeRole(
        'another-user-id',
        { role: 'member' },
        adminUser,
      );

      expect(result.id).toBe('another-user-id');
      expect(result.role).toBe('member');
      expect(result.message).toBe('ロールを変更しました');
    });

    it('service が BadRequestException を投げた場合はそのまま伝搬する', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      mockUsersService.changeRole.mockRejectedValueOnce(
        new BadRequestException('最後のadminを降格することはできません'),
      );

      await expect(
        controller.changeRole('admin-user-id', { role: 'manager' }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('service が NotFoundException を投げた場合はそのまま伝搬する', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockUsersService.changeRole.mockRejectedValueOnce(
        new NotFoundException('ユーザーが見つかりません'),
      );

      await expect(
        controller.changeRole('nonexistent-id', { role: 'manager' }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('セルフ変更（actor === target）の場合も service に正しく渡る', async () => {
      mockUsersService.changeRole.mockResolvedValueOnce({
        id: 'actor-admin-id',
        role: 'manager',
      });

      await controller.changeRole(
        'actor-admin-id',
        { role: 'manager' },
        adminUser,
      );

      expect(mockUsersService.changeRole).toHaveBeenCalledWith(
        'actor-admin-id',
        'manager',
        'actor-admin-id',
      );
    });
  });
});
