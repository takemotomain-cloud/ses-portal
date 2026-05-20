import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * テナント一覧（統計付き）
   */
  async findAll() {
    const tenants = await this.db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            employees: true,
            clients: true,
          },
        },
      },
    });
    return tenants;
  }

  /**
   * テナント詳細
   */
  async findOne(id: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            employees: true,
            clients: true,
            assignments: true,
          },
        },
        users: {
          include: {
            employee: {
              select: {
                id: true,
                lastName: true,
                firstName: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('テナントが見つかりません');
    return tenant;
  }

  /**
   * テナント新規作成（デフォルト管理者ユーザーも同時作成）
   */
  async create(data: {
    name: string;
    subdomain?: string;
    zipCode?: string;
    address?: string;
    tel?: string;
    email?: string;
    registrationNumber?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    planType?: string;
    maxUsers?: number;
    // デフォルト管理者情報
    adminLastName: string;
    adminFirstName: string;
    adminEmail: string;
    adminPassword?: string;
  }) {
    // 名前重複チェック
    const existing = await this.db.tenant.findFirst({
      where: {
        OR: [
          { name: data.name },
          ...(data.subdomain ? [{ subdomain: data.subdomain }] : []),
        ],
      },
    });
    if (existing) {
      if (existing.name === data.name) throw new BadRequestException('このテナント名は既に使用されています');
      if (existing.subdomain === data.subdomain) throw new BadRequestException('このサブドメインは既に使用されています');
    }

    const defaultPassword = data.adminPassword || 'Admin1234!';
    const passwordHash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);
    const tenant = await this.db.$transaction(async (tx) => {
      // サブドメインのサニタイズ（前後の空白除去、末尾のスラッシュ除去）
      const sanitizedSubdomain = data.subdomain ? data.subdomain.trim().replace(/\/+$/, '') : null;

      // テナント作成
      const newTenant = await tx.tenant.create({
        data: {
          name: data.name,
          subdomain: sanitizedSubdomain,
          zipCode: data.zipCode || null,
          address: data.address || null,
          tel: data.tel || null,
          email: data.email || null,
          registrationNumber: data.registrationNumber || null,
          bankName: data.bankName || null,
          bankBranch: data.bankBranch || null,
          bankAccountType: data.bankAccountType || null,
          bankAccountNumber: data.bankAccountNumber || null,
          bankAccountName: data.bankAccountName || null,
          planType: data.planType || 'standard',
          maxUsers: data.maxUsers || 50,
        },
      });

      // デフォルト部署を作成
      const dept = await tx.department.create({
        data: {
          tenantId: newTenant.id,
          name: '管理部',
          code: 'ADMIN',
        },
      });

      // デフォルト管理者Employeeを作成
      const adminEmployee = await tx.employee.create({
        data: {
          tenantId: newTenant.id,
          employeeCode: 'EMP-001',
          lastName: data.adminLastName,
          firstName: data.adminFirstName,
          lastNameKana: '',
          firstNameKana: '',
          birthDate: new Date('1990-01-01'),
          gender: 'other',
          hireDate: new Date(),
          employmentType: 'regular',
          contractType: 'fixed_term',
          departmentId: dept.id,
          email: data.adminEmail,
        },
      });

      // 管理者Userを作成
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          employeeId: adminEmployee.id,
          passwordHash,
          role: 'admin',
        },
      });

      this.logger.log(`テナント作成: ${newTenant.name} (id=${newTenant.id}), 管理者: ${data.adminEmail}`);
      return newTenant;
    });

    return tenant;
  }

  /**
   * テナント更新
   */
  async update(id: string, data: {
    name?: string;
    subdomain?: string;
    isActive?: boolean;
    zipCode?: string;
    address?: string;
    tel?: string;
    email?: string;
    registrationNumber?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    planType?: string;
    maxUsers?: number;
  }) {
    const existing = await this.db.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('テナントが見つかりません');

    // 名前/サブドメイン重複チェック（自分以外）
    if (data.name || data.subdomain) {
      const dup = await this.db.tenant.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(data.name ? [{ name: data.name }] : []),
            ...(data.subdomain ? [{ subdomain: data.subdomain }] : []),
          ],
        },
      });
      if (dup) {
        if (data.name && dup.name === data.name) throw new BadRequestException('このテナント名は既に使用されています');
        if (data.subdomain && dup.subdomain === data.subdomain) throw new BadRequestException('このサブドメインは既に使用されています');
      }
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subdomain !== undefined) {
      updateData.subdomain = data.subdomain ? data.subdomain.trim().replace(/\/+$/, '') : null;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.zipCode !== undefined) updateData.zipCode = data.zipCode || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.tel !== undefined) updateData.tel = data.tel || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.registrationNumber !== undefined) updateData.registrationNumber = data.registrationNumber || null;
    if (data.bankName !== undefined) updateData.bankName = data.bankName || null;
    if (data.bankBranch !== undefined) updateData.bankBranch = data.bankBranch || null;
    if (data.bankAccountType !== undefined) updateData.bankAccountType = data.bankAccountType || null;
    if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber || null;
    if (data.bankAccountName !== undefined) updateData.bankAccountName = data.bankAccountName || null;
    if (data.planType !== undefined) updateData.planType = data.planType;
    if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;

    return this.db.tenant.update({ where: { id }, data: updateData });
  }

  /**
   * テナント削除（全データのカスケード削除）
   */
  async remove(id: string) {
    const existing = await this.db.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('テナントが見つかりません');

    await this.db.tenant.delete({ where: { id } });
    this.logger.log(`テナント削除: ${existing.name} (id=${id})`);
    return { deleted: true };
  }

  /**
   * テナント有効/無効トグル
   */
  async toggleActive(id: string) {
    const existing = await this.db.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('テナントが見つかりません');
    return this.db.tenant.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }
}
