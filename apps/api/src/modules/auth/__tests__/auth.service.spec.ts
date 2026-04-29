/**
 * AuthService 単体テスト
 *
 * ログイン認証・アカウントロック・パスワードハッシュを検証する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit-logs/audit.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

/* ====== モック定義 ====== */

const mockPasswordHash = '$2b$12$mockhashedpassword';

const mockUser = {
  id: 'user-1',
  employeeId: 'emp-1',
  passwordHash: mockPasswordHash,
  role: 'employee',
  isLocked: false,
  failedLoginCount: 0,
  lastLoginAt: null,
  employee: {
    id: 'emp-1',
    employeeCode: 'EMP-001',
    lastName: '田中',
    firstName: '太郎',
    email: 'tanaka@example.com',
    status: 'active',
  },
};

function createMockDb() {
  return {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

function createMockJwt() {
  return {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };
}

/* ====== テストスイート ====== */

describe('AuthService', () => {
  let service: AuthService;
  let db: ReturnType<typeof createMockDb>;
  let jwt: ReturnType<typeof createMockJwt>;

  beforeEach(async () => {
    db = createMockDb();
    jwt = createMockJwt();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: db },
        { provide: JwtService, useValue: jwt },
        {
          provide: NotificationsService,
          useValue: {
            notifyAdmins: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /* ============================
   * login — 成功
   * ============================ */
  describe('ログイン成功', () => {
    it('正しい認証情報でJWTとユーザー情報を返す', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      db.user.update.mockResolvedValue({});

      const result = await service.login('tanaka@example.com', 'CorrectPass1!');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('tanaka@example.com');
      expect(result.user.name).toBe('田中 太郎');
      expect(result.user.role).toBe('employee');
    });

    it('成功時に失敗カウントをリセットする', async () => {
      db.user.findFirst.mockResolvedValue({
        ...mockUser,
        failedLoginCount: 3,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      db.user.update.mockResolvedValue({});

      await service.login('tanaka@example.com', 'CorrectPass1!');

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginCount: 0,
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it('JWTペイロードにsub/employeeId/roleを含む', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      db.user.update.mockResolvedValue({});

      await service.login('tanaka@example.com', 'CorrectPass1!');

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        employeeId: 'emp-1',
        role: 'employee',
      });
    });
  });

  /* ============================
   * login — 失敗
   * ============================ */
  describe('ログイン失敗', () => {
    it('存在しないメールアドレスでUnauthorizedException', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('パスワード不一致で失敗カウントを加算する', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser, failedLoginCount: 1 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      db.user.update.mockResolvedValue({});

      await expect(
        service.login('tanaka@example.com', 'WrongPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginCount: 2,
          isLocked: false,
        },
      });
    });

    it('5回目の失敗でアカウントをロックする', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser, failedLoginCount: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      db.user.update.mockResolvedValue({});

      await expect(
        service.login('tanaka@example.com', 'WrongPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginCount: 5,
          isLocked: true,
        },
      });
    });
  });

  /* ============================
   * login — ロック済みアカウント
   * ============================ */
  describe('アカウントロック', () => {
    it('ロック済みアカウントはログイン拒否', async () => {
      db.user.findFirst.mockResolvedValue({ ...mockUser, isLocked: true });

      await expect(
        service.login('tanaka@example.com', 'CorrectPass1!'),
      ).rejects.toThrow('アカウントがロックされています');
    });
  });

  /* ============================
   * login — 退職済み
   * ============================ */
  describe('退職済み社員', () => {
    it('退職済み社員はログイン拒否', async () => {
      db.user.findFirst.mockResolvedValue({
        ...mockUser,
        employee: { ...mockUser.employee, status: 'resigned' },
      });

      await expect(
        service.login('tanaka@example.com', 'CorrectPass1!'),
      ).rejects.toThrow('このアカウントは無効になっています');
    });
  });
});
