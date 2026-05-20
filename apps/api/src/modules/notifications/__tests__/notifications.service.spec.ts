/**
 * NotificationsService 単体テスト
 *
 * お知らせ一括送信・個別通知・既読管理を検証する。
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { DatabaseService } from '../../../database/database.service';

/* ====== モック定義 ====== */

const TENANT_ID = 'test-tenant-id';

function createMockDb() {
  return {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    assignment: {
      findMany: jest.fn(),
    },
  };
}

/* ====== テストスイート ====== */

describe('NotificationsService', () => {
  let service: NotificationsService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    db = createMockDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  /* ============================
   * getMyNotifications
   * ============================ */
  describe('getMyNotifications', () => {
    it('未読優先・新しい順で取得する', async () => {
      db.notification.findMany.mockResolvedValue([]);
      await service.getMyNotifications(TENANT_ID, 'emp-1');

      expect(db.notification.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', tenantId: TENANT_ID },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: 20,
      });
    });

    it('limitパラメータが反映される', async () => {
      db.notification.findMany.mockResolvedValue([]);
      await service.getMyNotifications(TENANT_ID, 'emp-1', 5);

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  /* ============================
   * markAsRead
   * ============================ */
  describe('markAsRead', () => {
    it('指定通知を既読にする', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 1 });
      await service.markAsRead(TENANT_ID, 'notif-1', 'emp-1');

      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', employeeId: 'emp-1', tenantId: TENANT_ID },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  /* ============================
   * markAllAsRead
   * ============================ */
  describe('markAllAsRead', () => {
    it('全未読を既読にする', async () => {
      db.notification.updateMany.mockResolvedValue({ count: 5 });
      await service.markAllAsRead(TENANT_ID, 'emp-1');

      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', isRead: false, tenantId: TENANT_ID },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  /* ============================
   * sendBulk
   * ============================ */
  describe('sendBulk', () => {
    it('全社員に送信する', async () => {
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-1' },
        { id: 'emp-2' },
        { id: 'emp-3' },
      ]);
      db.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await service.sendBulk(TENANT_ID, {
        title: 'テスト通知',
        body: '本文です',
        targetType: 'all',
      });

      expect(result.sentCount).toBe(3);
      expect(db.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            employeeId: 'emp-1',
            title: 'テスト通知',
            category: 'announcement',
            metadata: expect.objectContaining({ targetType: 'all', targetSummary: '全社員' }),
          }),
          expect.objectContaining({ employeeId: 'emp-2' }),
          expect.objectContaining({ employeeId: 'emp-3' }),
        ]),
      });
    });

    it('画像URL付きで送信する', async () => {
      db.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      db.notification.createMany.mockResolvedValue({ count: 1 });

      await service.sendBulk(TENANT_ID, {
        title: 'テスト',
        body: '本文',
        targetType: 'all',
        imageUrl: '/uploads/notifications/test.jpg',
      });

      expect(db.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            employeeId: 'emp-1',
            imageUrl: '/uploads/notifications/test.jpg',
            category: 'announcement',
          }),
        ],
      });
    });

    it('部署指定で送信する', async () => {
      db.department.findMany.mockResolvedValue([{ name: '開発部' }]);
      db.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      db.notification.createMany.mockResolvedValue({ count: 1 });

      await service.sendBulk(TENANT_ID, {
        title: 'テスト',
        body: '本文',
        targetType: 'department',
        targetIds: ['dept-1'],
      });

      expect(db.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: { in: ['dept-1'] },
            tenantId: TENANT_ID,
          }),
        }),
      );
    });

    it('エリア指定で送信する', async () => {
      db.assignment.findMany.mockResolvedValue([
        { employeeId: 'emp-1' },
        { employeeId: 'emp-2' },
      ]);
      db.notification.createMany.mockResolvedValue({ count: 2 });

      const result = await service.sendBulk(TENANT_ID, {
        title: 'テスト',
        body: '本文',
        targetType: 'area',
        targetArea: 'osaka',
      });

      expect(result.sentCount).toBe(2);
    });

    it('個別選択で送信する', async () => {
      db.employee.findMany.mockResolvedValue([
        { lastName: '田中', firstName: '太郎' },
        { lastName: '佐藤', firstName: '花子' },
      ]);
      db.notification.createMany.mockResolvedValue({ count: 2 });

      const result = await service.sendBulk(TENANT_ID, {
        title: 'テスト',
        body: '本文',
        targetType: 'individual',
        targetIds: ['emp-1', 'emp-2'],
      });

      expect(result.sentCount).toBe(2);
    });

    it('タイトルが空の場合はBadRequestException', async () => {
      await expect(
        service.sendBulk(TENANT_ID, { title: '', body: '本文', targetType: 'all' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('本文が空の場合はBadRequestException', async () => {
      await expect(
        service.sendBulk(TENANT_ID, { title: 'タイトル', body: '  ', targetType: 'all' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('部署未選択の場合はBadRequestException', async () => {
      await expect(
        service.sendBulk(TENANT_ID, { title: 'タイトル', body: '本文', targetType: 'department' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('エリア未選択の場合はBadRequestException', async () => {
      await expect(
        service.sendBulk(TENANT_ID, { title: 'タイトル', body: '本文', targetType: 'area' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('個別選択で社員未選択の場合はBadRequestException', async () => {
      await expect(
        service.sendBulk(TENANT_ID, { title: 'タイトル', body: '本文', targetType: 'individual', targetIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('全社員が0人の場合はBadRequestException', async () => {
      db.employee.findMany.mockResolvedValue([]);

      await expect(
        service.sendBulk(TENANT_ID, { title: 'タイトル', body: '本文', targetType: 'all' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ============================
   * getSentNotifications
   * ============================ */
  describe('getSentNotifications', () => {
    it('announcementId ごとに送信履歴をまとめる', async () => {
      db.notification.findMany.mockResolvedValue([
        {
          id: 'n1',
          title: 'メンテ',
          body: '本文',
          imageUrl: null,
          metadata: { announcementId: 'a-1', targetType: 'all', targetSummary: '全社員' },
          createdAt: new Date('2026-05-08T00:00:00Z'),
          isRead: false,
        },
        {
          id: 'n2',
          title: 'メンテ',
          body: '本文',
          imageUrl: null,
          metadata: { announcementId: 'a-1', targetType: 'all', targetSummary: '全社員' },
          createdAt: new Date('2026-05-08T00:00:00Z'),
          isRead: true,
        },
      ]);

      const result = await service.getSentNotifications();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        announcementId: 'a-1',
        sentCount: 2,
        readCount: 1,
        targetSummary: '全社員',
      }));
    });
  });

  /* ============================
   * getTargetOptions
   * ============================ */
  describe('getTargetOptions', () => {
    it('社員・部署・エリアの選択肢を返す', async () => {
      db.employee.findMany.mockResolvedValue([
        { id: 'emp-1', employeeCode: 'EMP-001', lastName: '田中', firstName: '太郎', departmentId: 'dept-1', department: { name: '開発部' } },
      ]);
      db.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: '開発部', code: 'DEV', parentId: null },
      ]);
      db.assignment.findMany.mockResolvedValue([
        { area: 'osaka' },
        { area: 'tokyo' },
      ]);

      const result = await service.getTargetOptions(TENANT_ID);

      expect(db.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
      expect(db.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
      expect(db.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );

      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].name).toBe('田中 太郎');
      expect(result.departments).toHaveLength(1);
      expect(result.areas).toHaveLength(2);
      expect(result.areas.find(a => a.value === 'osaka')?.label).toBe('大阪エリア');
    });
  });
});
