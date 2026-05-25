/**
 * マイナンバー暗号化移行スクリプト
 *
 * 既存の平文myNumberをAES-256-GCMで暗号化する。
 * 冪等性: 既に暗号化済み（':' を含む hex形式）のレコードはスキップ。
 *
 * 使い方:
 *   MYNUMBER_ENCRYPTION_KEY=<64文字のhex> npx ts-node prisma/migrate-mynumber-encryption.ts
 */

import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/common/utils/crypto';

const MYNUMBER_KEY = process.env.MYNUMBER_ENCRYPTION_KEY;
if (!MYNUMBER_KEY || MYNUMBER_KEY.length !== 64) {
  console.error('Error: MYNUMBER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const employees = await prisma.employee.findMany({
      where: { myNumber: { not: null } },
      select: { id: true, employeeCode: true, myNumber: true },
    });

    let encrypted = 0;
    let skipped = 0;

    for (const emp of employees) {
      if (!emp.myNumber) { skipped++; continue; }

      // 既に暗号化済みかチェック（暗号文は iv:authTag:ciphertext 形式）
      if (emp.myNumber.includes(':')) {
        skipped++;
        continue;
      }

      const encryptedValue = encrypt(emp.myNumber, MYNUMBER_KEY!);
      if (!encryptedValue) {
        console.warn(`Failed to encrypt myNumber for ${emp.employeeCode}`);
        continue;
      }

      await prisma.employee.update({
        where: { id: emp.id },
        data: { myNumber: encryptedValue },
      });
      encrypted++;
    }

    console.log(`Done: ${encrypted} encrypted, ${skipped} skipped (already encrypted or null)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
