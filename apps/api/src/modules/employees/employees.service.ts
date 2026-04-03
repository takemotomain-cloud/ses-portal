/**
 * Employees Service
 *
 * 社員データのCRUDビジネスロジック。
 * DBアクセスはPrisma経由。暗号化対象カラムはアプリ層で復号する。
 *
 * セキュリティ:
 * - マイナンバーは別途API（アクセスログ記録付き）で取得
 * - 一覧APIではmy_number, bank系を返さない（select指定で制限）
 * - 論理削除: deletedAt IS NULL のフィルタを全クエリに適用
 *
 * パフォーマンス:
 * - 一覧は必要カラムのみselect（N+1防止でinclude使用時は必要なリレーションのみ）
 * - ページネーション必須（デフォルト20件、最大100件）
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PAGINATION } from '@ses-portal/shared';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 社員一覧を取得
   *
   * 個人情報を含まない軽量レスポンスを返す。
   * 管理者は全社員、社員ロールは自分のみ。
   *
   * @param page ページ番号（1始まり）
   * @param limit 1ページあたりの件数
   * @param search 氏名検索（部分一致）
   * @param status ステータスフィルタ
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = params.page || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      params.limit || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT,
    );
    const skip = (page - 1) * limit;

    // WHERE条件を動的に組み立て
    const where: any = { deletedAt: null };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      // 姓 or 名 or 社員番号で部分一致検索
      where.OR = [
        { lastName: { contains: params.search } },
        { firstName: { contains: params.search } },
        { employeeCode: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          lastName: true,
          firstName: true,
          status: true,
          employmentType: true,
          contractType: true,
          hireDate: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
        orderBy: { employeeCode: 'asc' },
        skip,
        take: limit,
      }),
      this.db.employee.count({ where }),
    ]);

    return {
      data: data.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        lastName: e.lastName,
        firstName: e.firstName,
        status: e.status,
        employmentType: e.employmentType,
        contractType: e.contractType,
        hireDate: e.hireDate,
        departmentName: e.department?.name || '',
        positionName: e.position?.name || null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 社員詳細を取得
   *
   * マイナンバー・口座情報を含むフル情報を返す。
   * アクセスログは呼び出し側（コントローラー）で記録する。
   *
   * @param id 社員UUID
   * @throws NotFoundException 社員が見つからない場合
   */
  async findOne(id: string) {
    const employee = await this.db.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, name: true, rank: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('社員が見つかりません');
    }

    // マイナンバーは個別APIで取得（ここでは返さない）
    const { myNumber, ...safeEmployee } = employee;

    return safeEmployee;
  }

  /**
   * 社員の存在確認（他モジュールから呼ばれる）
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.db.employee.count({
      where: { id, deletedAt: null },
    });
    return count > 0;
  }
}
