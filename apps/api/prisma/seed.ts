import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 既存データをクリア（順序に注意）
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  await prisma.tenant.deleteMany();

  const systemTenantId = '00000000-0000-0000-0000-000000000001';
  const BCRYPT_ROUNDS = 12;

  // 1. システムテナントの作成
  const tenant = await prisma.tenant.upsert({
    where: { id: systemTenantId },
    update: {},
    create: {
      id: systemTenantId,
      name: '株式会社テスト',
      subdomain: 'testcompany',
      isActive: true,
    },
  });
  console.log('  Tenant created:', tenant.name);

  // 2. 部門と役職の作成（社員作成に必要）
  const dept = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      code: 'ADMIN',
      name: '管理部',
    },
  });

  const pos = await prisma.position.create({
    data: {
      tenantId: tenant.id,
      name: '管理者',
      rank: 1,
      hasApproval: true,
    },
  });

  // 3. システム管理者の作成
  const passwordHash = await bcrypt.hash('Admin1234!', BCRYPT_ROUNDS);

  const employee = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      employeeCode: 'ADMIN001',
      lastName: 'システム',
      firstName: '管理者',
      lastNameKana: 'システム',
      firstNameKana: 'カンリシャ',
      email: 'admin@example.com',
      birthDate: new Date('1990-01-01'),
      gender: 'other',
      hireDate: new Date('2026-01-01'),
      employmentType: 'full_time',
      departmentId: dept.id,
      positionId: pos.id,
    },
  });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      employeeId: employee.id,
      passwordHash,
      role: 'admin',
    },
  });

  console.log('  Admin user created: admin@example.com / Admin1234!');
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
