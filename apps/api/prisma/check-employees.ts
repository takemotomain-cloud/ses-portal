import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      lastName: true,
      firstName: true,
      employeeCode: true,
      tenantId: true,
      tenant: { select: { name: true } }
    }
  });

  console.log(JSON.stringify(employees, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
