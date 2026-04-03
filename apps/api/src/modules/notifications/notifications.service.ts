/**
 * Notifications Service
 *
 * 社員向け通知の管理。管理側のアクション（承認・給与確定等）で自動生成。
 * 社員はマイページのホーム画面で未読通知を確認する。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  /** 社員の通知一覧（未読優先、新しい順） */
  async getMyNotifications(employeeId: string, limit = 20) {
    return this.db.notification.findMany({
      where: { employeeId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /** 未読件数を取得 */
  async getUnreadCount(employeeId: string): Promise<number> {
    return this.db.notification.count({
      where: { employeeId, isRead: false },
    });
  }

  /** 既読にする */
  async markAsRead(notificationId: string, employeeId: string) {
    await this.db.notification.updateMany({
      where: { id: notificationId, employeeId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** 全件既読にする */
  async markAllAsRead(employeeId: string) {
    await this.db.notification.updateMany({
      where: { employeeId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * 通知を作成する（他モジュールから呼ばれる）
   *
   * 使用箇所:
   * - 有給申請の承認/却下時
   * - 給与明細の確定時
   * - 契約更新時
   */
  async create(data: {
    employeeId: string;
    title: string;
    body: string;
    category?: string;
  }) {
    const notification = await this.db.notification.create({ data });
    this.logger.log(`Notification created for employee ${data.employeeId}: ${data.title}`);
    return notification;
  }
}
