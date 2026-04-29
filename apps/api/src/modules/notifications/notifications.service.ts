/**
 * Notifications Service
 *
 * 社員向け通知の管理。
 * - 管理者が手動で一括送信（お知らせ機能）
 * - 他モジュールから自動生成（承認・給与確定等）
 * 社員はマイページのホーム画面で未読通知を確認する。
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * audience に応じた category 絞り込み条件を返す
   * - admin: 管理者向け（category='system'）のみ
   * - employee: 社員向け（category!='system' = announcement / null など）のみ
   * - 未指定: 全件
   */
  private buildAudienceWhere(audience?: 'admin' | 'employee') {
    if (audience === 'admin') return { category: 'system' };
    if (audience === 'employee') return { category: { not: 'system' } };
    return {};
  }

  /** 社員の通知一覧（未読優先、新しい順） */
  async getMyNotifications(employeeId: string, limit?: number, audience?: 'admin' | 'employee') {
    return this.db.notification.findMany({
      where: { employeeId, ...this.buildAudienceWhere(audience) },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: (limit && limit > 0) ? limit : 20,
    });
  }

  /** 未読件数を取得 */
  async getUnreadCount(employeeId: string, audience?: 'admin' | 'employee'): Promise<number> {
    return this.db.notification.count({
      where: { employeeId, isRead: false, ...this.buildAudienceWhere(audience) },
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
  async markAllAsRead(employeeId: string, audience?: 'admin' | 'employee') {
    await this.db.notification.updateMany({
      where: { employeeId, isRead: false, ...this.buildAudienceWhere(audience) },
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
    metadata?: any;
  }) {
    const notification = await this.db.notification.create({ data });
    this.logger.log(`Notification created for employee ${data.employeeId}: ${data.title}`);
    return notification;
  }

  /**
   * 管理者全員に通知を送信する（申請が来た時など）
   * employeeId を渡すと社員名を自動解決して body に含める
   */
  async notifyAdmins(title: string, body: string, employeeId?: string) {
    let resolvedBody = body;
    if (employeeId) {
      const emp = await this.db.employee.findUnique({
        where: { id: employeeId },
        select: { employeeCode: true, lastName: true, firstName: true },
      });
      if (emp) {
        resolvedBody = `${emp.lastName} ${emp.firstName}（${emp.employeeCode}）${body}`;
      }
    }

    const admins = await this.db.user.findMany({
      where: { role: 'admin' },
      select: { employeeId: true },
    });
    if (!admins.length) return;
    await this.db.notification.createMany({
      data: admins.map(a => ({
        employeeId: a.employeeId,
        title,
        body: resolvedBody,
        category: 'system',
      })),
    });
    this.logger.log(`Admin notification: "${title}" → ${admins.length}名`);
  }

  /* ==============================================
   * 管理者向け: お知らせ一括送信
   * ============================================== */

  /**
   * 送信先の選択肢を返す
   *
   * 管理画面の宛先セレクタ用:
   * - 社員一覧（id, name, departmentName）
   * - 部署一覧
   * - エリア一覧（assignments テーブルの area フィールドから動的取得）
   */
  async getTargetOptions() {
    const [employees, departments, areas] = await Promise.all([
      this.db.employee.findMany({
        where: { deletedAt: null, status: { not: 'resigned' } },
        select: {
          id: true,
          employeeCode: true,
          lastName: true,
          firstName: true,
          departmentId: true,
          department: { select: { name: true } },
        },
        orderBy: { employeeCode: 'asc' },
      }),
      this.db.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, parentId: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.db.assignment.findMany({
        where: { area: { not: null } },
        select: { area: true },
        distinct: ['area'],
      }),
    ]);

    // エリアラベルマッピング
    const areaLabels: Record<string, string> = {
      tokyo: '東京エリア',
      osaka: '大阪エリア',
      nagoya: '名古屋エリア',
    };

    return {
      employees: employees.map(e => ({
        id: e.id,
        employeeCode: e.employeeCode,
        name: `${e.lastName} ${e.firstName}`,
        departmentId: e.departmentId,
        departmentName: e.department?.name || '',
      })),
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        parentId: d.parentId,
      })),
      areas: areas
        .filter(a => a.area)
        .map(a => ({
          value: a.area!,
          label: areaLabels[a.area!] || a.area!,
        })),
    };
  }

  /**
   * お知らせを一括送信
   *
   * targetType に応じて対象社員を特定し、各社員に通知レコードを作成する。
   * - all: 全在籍社員
   * - department: 指定部署の社員（targetIds に部署IDリスト）
   * - area: 指定エリアに配属中の社員（targetArea にエリアコード）
   * - individual: 指定社員（targetIds に社員IDリスト）
   */
  async sendBulk(data: {
    title: string;
    body: string;
    targetType: 'all' | 'department' | 'area' | 'individual';
    targetIds?: string[];
    targetArea?: string;
    imageUrl?: string;
  }) {
    if (!data.title?.trim() || !data.body?.trim()) {
      throw new BadRequestException('タイトルと本文を入力してください');
    }

    let employeeIds: string[] = [];

    switch (data.targetType) {
      case 'all': {
        const employees = await this.db.employee.findMany({
          where: { deletedAt: null, status: { not: 'resigned' } },
          select: { id: true },
        });
        employeeIds = employees.map(e => e.id);
        break;
      }

      case 'department': {
        if (!data.targetIds?.length) {
          throw new BadRequestException('部署を選択してください');
        }
        const employees = await this.db.employee.findMany({
          where: {
            deletedAt: null,
            status: { not: 'resigned' },
            departmentId: { in: data.targetIds },
          },
          select: { id: true },
        });
        employeeIds = employees.map(e => e.id);
        break;
      }

      case 'area': {
        if (!data.targetArea) {
          throw new BadRequestException('エリアを選択してください');
        }
        // assignmentsテーブルから対象エリアの社員を取得
        const assignments = await this.db.assignment.findMany({
          where: { area: data.targetArea },
          select: { employeeId: true },
          distinct: ['employeeId'],
        });
        if (assignments.length === 0) {
          throw new BadRequestException('対象エリアに配属中の社員がいません');
        }
        employeeIds = assignments.map(a => a.employeeId);
        break;
      }

      case 'individual': {
        if (!data.targetIds?.length) {
          throw new BadRequestException('送信先の社員を選択してください');
        }
        employeeIds = data.targetIds;
        break;
      }

      default:
        throw new BadRequestException('無効な送信先タイプです');
    }

    if (employeeIds.length === 0) {
      throw new BadRequestException('送信対象の社員がいません');
    }

    // 一括作成
    const result = await this.db.notification.createMany({
      data: employeeIds.map(employeeId => ({
        employeeId,
        title: data.title.trim(),
        body: data.body.trim(),
        category: 'announcement',
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      })),
    });

    this.logger.log(`お知らせを一括送信: "${data.title}" → ${result.count}名`);

    return { sentCount: result.count };
  }

  /**
   * 送信済みお知らせ一覧（管理者用）
   *
   * category=announcement の通知をグルーピングして返す。
   * 同一タイトル・同一時刻の通知を1つのお知らせとしてまとめる。
   */
  async getSentNotifications() {
    const notifications = await this.db.notification.findMany({
      where: { category: 'announcement' },
      select: {
        title: true,
        body: true,
        imageUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['title', 'createdAt'],
      take: 50,
    });

    // 各お知らせの送信人数・既読数を集計
    const results = await Promise.all(
      notifications.map(async (n) => {
        const [total, readCount] = await Promise.all([
          this.db.notification.count({
            where: { title: n.title, createdAt: n.createdAt, category: 'announcement' },
          }),
          this.db.notification.count({
            where: { title: n.title, createdAt: n.createdAt, category: 'announcement', isRead: true },
          }),
        ]);
        return {
          title: n.title,
          body: n.body,
          createdAt: n.createdAt,
          sentCount: total,
          readCount,
        };
      }),
    );

    return results;
  }
}
