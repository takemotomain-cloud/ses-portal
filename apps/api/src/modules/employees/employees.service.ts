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

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PAGINATION } from '@ses-portal/shared';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

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
        emergencyContacts: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, relationship: true, phone: true, sortOrder: true },
        },
        dependents: {
          where: { isActive: true },
          select: { id: true, name: true, relationship: true, birthDate: true, annualIncome: true },
        },
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
   * 社員を新規登録
   *
   * Employee レコードと、ログイン用の User レコードを同時に作成する。
   * デフォルトパスワードは "Pass1234!" （初回ログイン時に変更を促す想定）。
   *
   * @param data フォームから受け取った社員情報
   * @throws BadRequestException メール重複・社員番号重複の場合
   */
  async create(data: {
    lastName: string;
    firstName: string;
    lastNameKana?: string;
    firstNameKana?: string;
    employeeCode: string;
    hireDate: string;
    departmentId: string;
    employmentType?: string;
    contractType?: string;
    birthDate?: string;
    education?: string;
    schoolName?: string;
    email: string;
    phone?: string;
    address?: string;
    gender?: string;
    baseSalary?: number;
    rewardRate?: number;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
  }) {
    // 重複チェック
    const existingEmail = await this.db.employee.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (existingEmail) {
      throw new BadRequestException('このメールアドレスは既に使用されています');
    }

    const existingCode = await this.db.employee.findFirst({
      where: { employeeCode: data.employeeCode, deletedAt: null },
    });
    if (existingCode) {
      throw new BadRequestException('この社員番号は既に使用されています');
    }

    // デフォルトパスワードのハッシュ
    const defaultPassword = 'Pass1234!';
    const passwordHash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);

    // トランザクションで Employee + User を同時作成
    const employee = await this.db.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          lastName: data.lastName,
          firstName: data.firstName,
          lastNameKana: data.lastNameKana || '',
          firstNameKana: data.firstNameKana || '',
          employeeCode: data.employeeCode,
          hireDate: new Date(data.hireDate),
          departmentId: data.departmentId,
          employmentType: data.employmentType || 'regular',
          contractType: data.contractType || 'fixed_term',
          birthDate: data.birthDate ? new Date(data.birthDate) : new Date('2000-01-01'),
          gender: data.gender || 'other',
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          education: data.education || null,
          schoolName: data.schoolName || null,
          baseSalary: data.baseSalary || null,
          rewardRate: data.rewardRate || null,
          bankName: data.bankName || null,
          bankBranch: data.bankBranch || null,
          bankAccountType: data.bankAccountType || null,
          bankAccountNumber: data.bankAccountNumber || null,
        },
      });

      // ログイン用 User レコード作成
      await tx.user.create({
        data: {
          employeeId: emp.id,
          passwordHash,
          role: 'employee',
        },
      });

      return emp;
    });

    this.logger.log(`社員を登録しました: ${employee.employeeCode} ${employee.lastName} ${employee.firstName}`);

    return { id: employee.id, employeeCode: employee.employeeCode };
  }

  /**
   * 社員情報を更新
   *
   * @param id 社員UUID
   * @param data 更新対象フィールド（部分更新可能）
   * @throws NotFoundException 社員が見つからない場合
   * @throws BadRequestException メール重複の場合
   */
  async update(id: string, data: {
    lastName?: string;
    firstName?: string;
    lastNameKana?: string;
    firstNameKana?: string;
    departmentId?: string;
    employmentType?: string;
    contractType?: string;
    status?: string;
    education?: string;
    schoolName?: string;
    email?: string;
    phone?: string;
    address?: string;
    birthDate?: string;
    gender?: string;
    baseSalary?: number;
    rewardRate?: number;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
  }) {
    // 存在確認
    const existing = await this.db.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('社員が見つかりません');
    }

    // メール重複チェック（自分以外）
    if (data.email && data.email !== existing.email) {
      const emailExists = await this.db.employee.findFirst({
        where: { email: data.email, deletedAt: null, id: { not: id } },
      });
      if (emailExists) {
        throw new BadRequestException('このメールアドレスは既に使用されています');
      }
    }

    // 更新データを組み立て（undefinedのフィールドは除外）
    const updateData: any = {};
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastNameKana !== undefined) updateData.lastNameKana = data.lastNameKana;
    if (data.firstNameKana !== undefined) updateData.firstNameKana = data.firstNameKana;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.contractType !== undefined) updateData.contractType = data.contractType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.education !== undefined) updateData.education = data.education;
    if (data.schoolName !== undefined) updateData.schoolName = data.schoolName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.birthDate !== undefined) updateData.birthDate = new Date(data.birthDate);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.baseSalary !== undefined) updateData.baseSalary = data.baseSalary;
    if (data.rewardRate !== undefined) updateData.rewardRate = data.rewardRate;
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
    if (data.bankBranch !== undefined) updateData.bankBranch = data.bankBranch;
    if (data.bankAccountType !== undefined) updateData.bankAccountType = data.bankAccountType;
    if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber;

    const updated = await this.db.employee.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`社員を更新しました: ${updated.employeeCode} ${updated.lastName} ${updated.firstName}`);

    return { id: updated.id };
  }

  /**
   * 緊急連絡先を登録
   *
   * @param employeeId 社員UUID
   * @param data 緊急連絡先情報
   */
  async createEmergencyContact(employeeId: string, data: {
    name: string;
    relationship: string;
    phone: string;
  }) {
    // 社員存在確認
    const emp = await this.db.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
    });
    if (!emp) {
      throw new NotFoundException('社員が見つかりません');
    }

    // sortOrder を自動設定（既存の最大値 + 1）
    const maxSort = await this.db.emergencyContact.findFirst({
      where: { employeeId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? 0) + 1;

    const contact = await this.db.emergencyContact.create({
      data: {
        employeeId,
        name: data.name,
        relationship: data.relationship,
        phone: data.phone,
        sortOrder,
      },
    });

    this.logger.log(`緊急連絡先を登録しました: employee=${employeeId}, contact=${contact.id}`);

    return { id: contact.id };
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
