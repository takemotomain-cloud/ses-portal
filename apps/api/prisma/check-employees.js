const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      lastName: true,
      firstName: true,
      employeeCode: true,
      tenantId: true
    }
  });
  console.log(JSON.stringify(employees, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
