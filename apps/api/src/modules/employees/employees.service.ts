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
import { LeaveService } from '../leave/leave.service';
import { AuditService } from '../audit-logs/audit.service';
import { PAGINATION } from '@ses-portal/shared';
import * as bcrypt from 'bcrypt';
import { encrypt, decrypt } from '../../common/utils/crypto';

const MYNUMBER_KEY = process.env.MYNUMBER_ENCRYPTION_KEY || '';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly leaveService: LeaveService,
    private readonly auditService: AuditService,
  ) {}

  private normalizeBloodType(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

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
   * アサイン未経験社員一覧（新規タブ用）
   * 一度もアサインされたことがない社員を返す。
   */
  async findUnassigned() {
    // SES事業部（parent_idがNULL & code='SES'）配下の社員のみ
    const sesDept = await this.db.department.findFirst({
      where: { code: 'SES', parentId: null },
      select: { id: true },
    });

    const sesDeptIds: string[] = [];
    if (sesDept) {
      sesDeptIds.push(sesDept.id);
      const children = await this.db.department.findMany({
        where: { parentId: sesDept.id },
        select: { id: true },
      });
      sesDeptIds.push(...children.map((c) => c.id));
    }

    const where: any = {
      deletedAt: null,
      assignments: { none: {} },
      ...(sesDeptIds.length > 0 ? { departmentId: { in: sesDeptIds } } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          lastName: true,
          firstName: true,
          status: true,
          hireDate: true,
          department: { select: { name: true } },
        },
        orderBy: { hireDate: 'desc' },
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
        hireDate: e.hireDate,
        departmentName: e.department?.name || '',
      })),
      total,
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
        // E: フロント側のロール表示 + ロール変更 API 用に user.id も含める
        user: { select: { id: true, role: true } },
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
        meetings: {
          orderBy: { date: 'desc' },
          select: { id: true, date: true, interviewer: true, content: true, videoUrl: true },
        },
        leaveBalances: {
          orderBy: { grantedDate: 'desc' },
          select: {
            id: true, grantedDate: true, expiryDate: true,
            grantedDays: true, usedDays: true, remainingDays: true,
          },
        },
        certificates: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, certType: true, status: true,
            filePath: true, issuedAt: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('社員が見つかりません');
    }

    // マイナンバーは個別APIで取得（ここでは返さない）
    const { myNumber, ...safeEmployee } = employee;

    // 勤怠月別サマリー（直近6ヶ月）
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const attendances = await this.db.attendance.findMany({
      where: {
        employeeId: id,
        workDate: { gte: sixMonthsAgo },
      },
      orderBy: { workDate: 'asc' },
    });

    // 月ごとに集計
    const monthlyMap = new Map<string, {
      yearMonth: string;
      workDays: number;
      totalWorkMinutes: number;
      totalOvertimeMinutes: number;
      missedClockCount: number;
      lateCount: number;
      absentCount: number;
    }>();

    for (const a of attendances) {
      const d = new Date(a.workDate);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(ym)) {
        monthlyMap.set(ym, {
          yearMonth: ym,
          workDays: 0,
          totalWorkMinutes: 0,
          totalOvertimeMinutes: 0,
          missedClockCount: 0,
          lateCount: 0,
          absentCount: 0,
        });
      }
      const m = monthlyMap.get(ym)!;
      m.workDays++;
      m.totalWorkMinutes += a.workMinutes || 0;
      m.totalOvertimeMinutes += a.overtimeMinutes || 0;
      if (a.isMissedClock) m.missedClockCount++;
      if (a.status === 'late') m.lateCount++;
      if (a.status === 'absent') m.absentCount++;
    }

    const attendanceSummary = Array.from(monthlyMap.values()).sort(
      (a, b) => b.yearMonth.localeCompare(a.yearMonth),
    );

    return { ...safeEmployee, attendanceSummary };
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
    employeeCode?: string;
    hireDate: string;
    departmentId: string;
    employmentType?: string;
    contractType?: string;
    birthDate?: string;
    bloodType?: string;
    education?: string;
    schoolName?: string;
    email: string;
    phone?: string;
    postalCode?: string;
    address?: string;
    station?: string;
    gender?: string;
    baseSalary?: number;
    rewardRate?: number;
    contractHours?: number;
    fixedOvertime?: number;
    commuteStyle?: 'onetime' | 'monthly' | 'three_month' | null;
    leaveGrantMethod?: 'hire_date' | 'transferred' | null;
    transferredLeaveDays?: number;
    transferredLeaveGrantedDate?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
  }, actorUserId?: string) {
    // 重複チェック
    const existingEmail = await this.db.employee.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (existingEmail) {
      throw new BadRequestException('このメールアドレスは既に使用されています');
    }

    // 社員番号が未指定または重複の場合は自動採番
    let employeeCode = data.employeeCode;
    if (!employeeCode) {
      const latest = await this.db.employee.findFirst({
        orderBy: { employeeCode: 'desc' },
        select: { employeeCode: true },
      });
      const lastNum = latest?.employeeCode ? parseInt(latest.employeeCode.replace(/\D/g, ''), 10) : 0;
      employeeCode = `EMP-${String(lastNum + 1).padStart(3, '0')}`;
    }
    const existingCode = await this.db.employee.findFirst({
      where: { employeeCode, deletedAt: null },
    });
    if (existingCode) {
      throw new BadRequestException('この社員番号は既に使用されています');
    }

    // departmentId がUUIDでない場合、部署名からIDを解決
    let departmentId = data.departmentId;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(departmentId)) {
      const dept = await this.db.department.findFirst({
        where: { name: departmentId },
        select: { id: true },
      });
      if (dept) {
        departmentId = dept.id;
      } else {
        // デフォルトでSES事業部
        const defaultDept = await this.db.department.findFirst({ select: { id: true } });
        departmentId = defaultDept?.id || data.departmentId;
      }
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
          employeeCode,
          hireDate: new Date(data.hireDate),
          departmentId,
          employmentType: (() => {
            const empMap: Record<string, string> = { '正社員': 'regular', '契約社員': 'contract', 'パート': 'part_time' };
            return data.employmentType ? (empMap[data.employmentType] || data.employmentType) : 'regular';
          })(),
          contractType: data.contractType || 'fixed_term',
          birthDate: data.birthDate ? new Date(data.birthDate) : new Date('2000-01-01'),
          gender: data.gender || 'other',
          bloodType: this.normalizeBloodType(data.bloodType),
          email: data.email,
          phone: data.phone || null,
          postalCode: data.postalCode || null,
          address: data.address || null,
          station: data.station || null,
          education: (() => {
            const eduMap: Record<string, string> = { '大卒': 'university', '大学院卒': 'grad_school', '専門卒': 'vocational', '短大卒': 'junior_college', '高専卒': 'technical_college', '高卒': 'high_school' };
            return data.education ? (eduMap[data.education] || data.education) : null;
          })(),
          schoolName: data.schoolName || null,
          baseSalary: data.baseSalary || null,
          rewardRate: data.rewardRate || null,
          contractHours: data.contractHours ?? null,
          fixedOvertime: data.fixedOvertime ?? null,
          commuteStyle: data.commuteStyle || null,
          leaveGrantMethod: data.leaveGrantMethod || 'hire_date',
          transferredLeaveDays: data.transferredLeaveDays ?? null,
          transferredLeaveGrantedDate: data.transferredLeaveGrantedDate
            ? new Date(data.transferredLeaveGrantedDate)
            : null,
          bankName: data.bankName || null,
          bankBranch: data.bankBranch || null,
          bankAccountType: data.bankAccountType || null,
          bankAccountNumber: data.bankAccountNumber || null,
          bankAccountHolder: data.bankAccountHolder || null,
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

    // L2: 社員追加時に有給を自動付与
    try {
      const grantMethod = (data.leaveGrantMethod || 'hire_date') as 'hire_date' | 'transferred';
      await this.leaveService.grantInitialLeave(employee.id, {
        grantMethod,
        hireDate: new Date(data.hireDate),
        transferredDays: data.transferredLeaveDays,
        transferredGrantedDate: data.transferredLeaveGrantedDate
          ? new Date(data.transferredLeaveGrantedDate)
          : undefined,
      });
    } catch (err) {
      this.logger.error(`有給の自動付与に失敗: employee=${employee.id}`, err as any);
    }

    // T2: 監査ログ
    await this.auditService.log({
      userId: actorUserId,
      action: 'employee.create',
      targetTable: 'employees',
      targetId: employee.id,
      newValue: {
        employeeCode: employee.employeeCode,
        lastName: employee.lastName,
        firstName: employee.firstName,
        email: employee.email,
        departmentId: employee.departmentId,
      },
    });

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
  /**
   * 給与テーブル（等級マスタ）一覧
   */
  async getSalaryGrades() {
    return this.db.salaryGrade.findMany({
      orderBy: [{ department: 'asc' }, { overtimeType: 'asc' }, { grade: 'asc' }],
    });
  }

  async update(id: string, data: {
    salaryGradeId?: string | null;
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
    bloodType?: string;
    baseSalary?: number;
    rewardRate?: number;
    contractHours?: number | null;
    fixedOvertime?: number | null;
    // J1: 社員別料率上書き
    rateHealthInsurance?: number | null;
    rateEmployeePension?: number | null;
    rateEmploymentInsurance?: number | null;
    rateIncomeTax?: number | null;
    rateResidentTaxFixed?: number | null;
    commuteStyle?: 'onetime' | 'monthly' | 'three_month' | null;
    leaveGrantMethod?: 'hire_date' | 'transferred' | null;
    transferredLeaveDays?: number | null;
    transferredLeaveGrantedDate?: string | null;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    station?: string;
    qualifications?: any;
    hasBonus?: boolean;
    resignDate?: string | null;
    myNumber?: string | null;
  }, actorUserId?: string) {
    // 存在確認
    const existing = await this.db.employee.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true, role: true } } },
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

    // 退職処理のバリデーション
    // status='resigned' に変更する場合、退職日が必須
    const newStatus = data.status ?? existing.status;
    const newResignDate = data.resignDate !== undefined ? data.resignDate : (existing.resignDate ? existing.resignDate.toISOString().slice(0, 10) : null);
    if (newStatus === 'resigned' && !newResignDate) {
      throw new BadRequestException('退職ステータスにする場合は退職日を入力してください');
    }

    // E: 最後の admin 保護 — admin ユーザーを退職（status=resigned）にしようとしたら拒否
    if (
      newStatus === 'resigned' &&
      existing.status !== 'resigned' &&
      existing.user?.role === 'admin'
    ) {
      const activeAdminCount = await this.db.user.count({
        where: { role: 'admin', employee: { deletedAt: null, status: { not: 'resigned' } } },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          '最後のadminを退職させることはできません。別のユーザーをadminに昇格してから退職処理を行ってください。',
        );
      }
    }

    // salaryGradeId が指定された場合、等級マスタから baseSalary 等を自動セット
    if (data.salaryGradeId !== undefined) {
      if (data.salaryGradeId) {
        const grade = await this.db.salaryGrade.findUnique({ where: { id: data.salaryGradeId } });
        if (!grade) throw new BadRequestException('指定された給与等級が見つかりません');
        data.baseSalary = grade.baseSalary;
        (data as any).fixedOvertimePay = grade.fixedOvertimePay;
        data.fixedOvertime = grade.overtimeType;
        data.contractHours = 168; // 所定労働時間は固定
      }
    }

    // 更新データを組み立て（undefinedのフィールドは除外）
    const updateData: any = {};
    if (data.salaryGradeId !== undefined) updateData.salaryGradeId = data.salaryGradeId;
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
    if (data.bloodType !== undefined) updateData.bloodType = this.normalizeBloodType(data.bloodType);
    if (data.baseSalary !== undefined) updateData.baseSalary = data.baseSalary;
    if ((data as any).fixedOvertimePay !== undefined) updateData.fixedOvertimePay = (data as any).fixedOvertimePay;
    if (data.rewardRate !== undefined) updateData.rewardRate = data.rewardRate;
    if (data.contractHours !== undefined) updateData.contractHours = data.contractHours;
    if (data.fixedOvertime !== undefined) updateData.fixedOvertime = data.fixedOvertime;
    if (data.rateHealthInsurance !== undefined) updateData.rateHealthInsurance = data.rateHealthInsurance;
    if (data.rateEmployeePension !== undefined) updateData.rateEmployeePension = data.rateEmployeePension;
    if (data.rateEmploymentInsurance !== undefined) updateData.rateEmploymentInsurance = data.rateEmploymentInsurance;
    if (data.rateIncomeTax !== undefined) updateData.rateIncomeTax = data.rateIncomeTax;
    if (data.rateResidentTaxFixed !== undefined) updateData.rateResidentTaxFixed = data.rateResidentTaxFixed;
    if (data.commuteStyle !== undefined) updateData.commuteStyle = data.commuteStyle;
    if (data.leaveGrantMethod !== undefined) updateData.leaveGrantMethod = data.leaveGrantMethod;
    if (data.transferredLeaveDays !== undefined) updateData.transferredLeaveDays = data.transferredLeaveDays;
    if (data.transferredLeaveGrantedDate !== undefined) {
      updateData.transferredLeaveGrantedDate = data.transferredLeaveGrantedDate
        ? new Date(data.transferredLeaveGrantedDate)
        : null;
    }
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
    if (data.bankBranch !== undefined) updateData.bankBranch = data.bankBranch;
    if (data.bankAccountType !== undefined) updateData.bankAccountType = data.bankAccountType;
    if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber;
    if (data.bankAccountHolder !== undefined) updateData.bankAccountHolder = data.bankAccountHolder;
    if (data.station !== undefined) updateData.station = data.station;
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
    if (data.hasBonus !== undefined) updateData.hasBonus = data.hasBonus;
    if (data.resignDate !== undefined) {
      updateData.resignDate = data.resignDate ? new Date(data.resignDate) : null;
    }
    if (data.myNumber !== undefined) {
      updateData.myNumber = data.myNumber && MYNUMBER_KEY
        ? encrypt(data.myNumber, MYNUMBER_KEY)
        : data.myNumber;
    }

    const updated = await this.db.employee.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`社員を更新しました: ${updated.employeeCode} ${updated.lastName} ${updated.firstName}`);

    // T2: 監査ログ（変更前→変更後）
    const oldSnapshot: any = {};
    const newSnapshot: any = {};
    for (const key of Object.keys(updateData)) {
      oldSnapshot[key] = (existing as any)[key] ?? null;
      newSnapshot[key] = (updated as any)[key] ?? null;
    }
    await this.auditService.log({
      userId: actorUserId,
      action: 'employee.update',
      targetTable: 'employees',
      targetId: id,
      oldValue: oldSnapshot,
      newValue: newSnapshot,
    });

    return { id: updated.id };
  }

  /**
   * 論理削除済み社員一覧を取得（P1 復活フロー用）
   */
  async findDeleted() {
    const data = await this.db.employee.findMany({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        employeeCode: true,
        lastName: true,
        firstName: true,
        status: true,
        employmentType: true,
        hireDate: true,
        resignDate: true,
        deletedAt: true,
        department: { select: { name: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });

    return {
      data: data.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        lastName: e.lastName,
        firstName: e.firstName,
        status: e.status,
        employmentType: e.employmentType,
        hireDate: e.hireDate,
        resignDate: e.resignDate,
        deletedAt: e.deletedAt,
        departmentName: e.department?.name || '',
      })),
      total: data.length,
    };
  }

  /**
   * 社員を論理削除
   *
   * deletedAt にタイムスタンプをセットする。実レコードは残すため
   * 紐づく過去データ（勤怠・給与・アサインなど）は保護される。
   */
  async softDelete(id: string, actorUserId?: string) {
    const existing = await this.db.employee.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!existing) {
      throw new NotFoundException('社員が見つかりません');
    }

    // E: 最後の admin 保護
    if (existing.user?.role === 'admin') {
      const activeAdminCount = await this.db.user.count({
        where: { role: 'admin', employee: { deletedAt: null } },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          '最後のadminを削除することはできません。別のユーザーをadminに昇格してから削除してください。',
        );
      }
    }

    await this.db.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`社員を論理削除しました: ${existing.employeeCode} ${existing.lastName} ${existing.firstName}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'employee.soft_delete',
      targetTable: 'employees',
      targetId: id,
      oldValue: { employeeCode: existing.employeeCode, email: existing.email },
    });

    return { id, deleted: true };
  }

  /**
   * 論理削除済み社員を復活（P1）
   *
   * deletedAt を null に戻す。復活対象が存在しない or 既にアクティブなら 404。
   * メール重複・社員番号重複が発生した場合はエラー（復活ブロック）。
   */
  /**
   * マイナンバー閲覧（admin 限定、監査ログ必須・T2）
   *
   * 取得した時点でアクセスログを残す。マスクなしの値を返すので、
   * UI 側は明示的に「閲覧」ボタンを押した時のみ呼び出すこと。
   */
  async getMyNumber(id: string, actorUserId?: string) {
    const target = await this.db.employee.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        lastName: true,
        firstName: true,
        myNumber: true,
      },
    });
    if (!target) {
      throw new NotFoundException('社員が見つかりません');
    }

    await this.auditService.log({
      userId: actorUserId,
      action: 'pii.mynumber_view',
      targetTable: 'employees',
      targetId: id,
    });

    // myNumberが暗号化されている場合は復号、平文の場合はそのまま返す
    let myNumberValue = target.myNumber || null;
    if (myNumberValue && MYNUMBER_KEY && myNumberValue.includes(':')) {
      myNumberValue = decrypt(myNumberValue, MYNUMBER_KEY) ?? myNumberValue;
    }

    return {
      id: target.id,
      employeeCode: target.employeeCode,
      name: `${target.lastName} ${target.firstName}`,
      myNumber: myNumberValue,
    };
  }

  /**
   * 銀行口座閲覧（admin 限定、監査ログ必須・T2）
   */
  async getBankAccount(id: string, actorUserId?: string) {
    const target = await this.db.employee.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        lastName: true,
        firstName: true,
        bankName: true,
        bankBranch: true,
        bankAccountType: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
      },
    });
    if (!target) {
      throw new NotFoundException('社員が見つかりません');
    }

    await this.auditService.log({
      userId: actorUserId,
      action: 'pii.bank_view',
      targetTable: 'employees',
      targetId: id,
    });

    return {
      id: target.id,
      employeeCode: target.employeeCode,
      name: `${target.lastName} ${target.firstName}`,
      bankName: target.bankName,
      bankBranch: target.bankBranch,
      bankAccountType: target.bankAccountType,
      bankAccountNumber: target.bankAccountNumber,
      bankAccountHolder: target.bankAccountHolder,
    };
  }

  async restore(id: string, actorUserId?: string) {
    const target = await this.db.employee.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('社員が見つかりません');
    }
    if (target.deletedAt === null) {
      throw new BadRequestException('この社員は削除されていません');
    }

    // 復活時にメール / 社員番号がアクティブな他社員と衝突していないかチェック
    const emailConflict = await this.db.employee.findFirst({
      where: { email: target.email, deletedAt: null, id: { not: id } },
    });
    if (emailConflict) {
      throw new BadRequestException('同じメールアドレスのアクティブ社員が存在するため復活できません');
    }

    const codeConflict = await this.db.employee.findFirst({
      where: { employeeCode: target.employeeCode, deletedAt: null, id: { not: id } },
    });
    if (codeConflict) {
      throw new BadRequestException('同じ社員番号のアクティブ社員が存在するため復活できません');
    }

    await this.db.employee.update({
      where: { id },
      data: { deletedAt: null },
    });

    this.logger.log(`社員を復活しました: ${target.employeeCode} ${target.lastName} ${target.firstName}`);

    await this.auditService.log({
      userId: actorUserId,
      action: 'employee.restore',
      targetTable: 'employees',
      targetId: id,
      newValue: { employeeCode: target.employeeCode, email: target.email },
    });

    return { id, restored: true };
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

  // ----------------------------------------
  // 住民税（特別徴収）管理
  // ----------------------------------------

  async getResidentTaxes(employeeId: string, fiscalYear: number) {
    const records = await this.db.employeeResidentTax.findMany({
      where: { employeeId, fiscalYear },
      orderBy: { month: 'asc' },
    });
    // 12ヶ月分を返す（未登録月は amount: 0）
    const monthOrder = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
    const map = new Map(records.map(r => [r.month, r]));
    return monthOrder.map(m => ({
      month: m,
      amount: map.get(m)?.amount ?? 0,
      id: map.get(m)?.id ?? null,
    }));
  }

  async upsertResidentTaxes(employeeId: string, fiscalYear: number, amounts: Record<string, number>) {
    const employee = await this.db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('社員が見つかりません');

    const upserts = Object.entries(amounts).map(([monthStr, amount]) => {
      const month = Number(monthStr);
      return this.db.employeeResidentTax.upsert({
        where: { employeeId_fiscalYear_month: { employeeId, fiscalYear, month } },
        create: { employeeId, fiscalYear, month, amount },
        update: { amount },
      });
    });
    await this.db.$transaction(upserts);
    return this.getResidentTaxes(employeeId, fiscalYear);
  }

  // ----------------------------------------
  // 扶養家族管理
  // ----------------------------------------

  async createDependent(employeeId: string, data: { name: string; relationship: string; birthDate: string; annualIncome?: number }) {
    const employee = await this.db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('社員が見つかりません');

    const dep = await this.db.dependent.create({
      data: {
        employeeId,
        name: data.name,
        relationship: data.relationship,
        birthDate: new Date(data.birthDate),
        annualIncome: data.annualIncome ?? null,
      },
    });
    return dep;
  }

  async updateDependent(employeeId: string, depId: string, data: { name?: string; relationship?: string; birthDate?: string; annualIncome?: number }) {
    const dep = await this.db.dependent.findFirst({
      where: { id: depId, employeeId, deletedAt: null },
    });
    if (!dep) throw new NotFoundException('扶養家族が見つかりません');

    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.relationship !== undefined) update.relationship = data.relationship;
    if (data.birthDate !== undefined) update.birthDate = new Date(data.birthDate);
    if (data.annualIncome !== undefined) update.annualIncome = data.annualIncome;

    return this.db.dependent.update({ where: { id: depId }, data: update });
  }

  async deleteDependent(employeeId: string, depId: string) {
    const dep = await this.db.dependent.findFirst({
      where: { id: depId, employeeId, deletedAt: null },
    });
    if (!dep) throw new NotFoundException('扶養家族が見つかりません');

    await this.db.dependent.update({
      where: { id: depId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }
}
