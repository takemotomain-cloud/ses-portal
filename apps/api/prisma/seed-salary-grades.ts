/**
 * 給与テーブル（等級マスタ）シードスクリプト
 *
 * SES事業部: 等級1〜81、固定残業20H、所定168H
 * 管理部メンバー: 固定残業20H、総支給239,000〜298,000（1,000円刻み）
 * 管理部主任以上: 固定残業40H（時間外30h+深夜10h）、総支給290,500〜379,000
 *
 * Usage: npx ts-node prisma/seed-salary-grades.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SES事業部 等級テーブル（所定168H、固定残業20H）
// 月給 = 基本給 + みなし残業20H分（端数切り上げ）
const SES_GRADES: { grade: number; grossSalary: number; baseSalary: number; fixedOvertimePay: number }[] = [
  { grade: 1, grossSalary: 239571, baseSalary: 208538, fixedOvertimePay: 31033 },
  { grade: 2, grossSalary: 239571, baseSalary: 208538, fixedOvertimePay: 31033 },
  { grade: 3, grossSalary: 239571, baseSalary: 208538, fixedOvertimePay: 31033 },
  { grade: 4, grossSalary: 239571, baseSalary: 208538, fixedOvertimePay: 31033 },
  { grade: 5, grossSalary: 245142, baseSalary: 213387, fixedOvertimePay: 31755 },
  { grade: 6, grossSalary: 250714, baseSalary: 218238, fixedOvertimePay: 32476 },
  { grade: 7, grossSalary: 256285, baseSalary: 223087, fixedOvertimePay: 33198 },
  { grade: 8, grossSalary: 261857, baseSalary: 227937, fixedOvertimePay: 33920 },
  { grade: 9, grossSalary: 267428, baseSalary: 232787, fixedOvertimePay: 34641 },
  { grade: 10, grossSalary: 273000, baseSalary: 237637, fixedOvertimePay: 35363 },
  { grade: 11, grossSalary: 278571, baseSalary: 242486, fixedOvertimePay: 36085 },
  { grade: 12, grossSalary: 284143, baseSalary: 247336, fixedOvertimePay: 36807 },
  { grade: 13, grossSalary: 289714, baseSalary: 252186, fixedOvertimePay: 37528 },
  { grade: 14, grossSalary: 295286, baseSalary: 257036, fixedOvertimePay: 38250 },
  { grade: 15, grossSalary: 300857, baseSalary: 261885, fixedOvertimePay: 38972 },
  { grade: 16, grossSalary: 306429, baseSalary: 266736, fixedOvertimePay: 39693 },
  { grade: 17, grossSalary: 312000, baseSalary: 271585, fixedOvertimePay: 40415 },
  { grade: 18, grossSalary: 317571, baseSalary: 276434, fixedOvertimePay: 41137 },
  { grade: 19, grossSalary: 323143, baseSalary: 281285, fixedOvertimePay: 41858 },
  { grade: 20, grossSalary: 328714, baseSalary: 286134, fixedOvertimePay: 42580 },
  { grade: 21, grossSalary: 334286, baseSalary: 290984, fixedOvertimePay: 43302 },
  { grade: 22, grossSalary: 339857, baseSalary: 295834, fixedOvertimePay: 44023 },
  { grade: 23, grossSalary: 345429, baseSalary: 300684, fixedOvertimePay: 44745 },
  { grade: 24, grossSalary: 351000, baseSalary: 305533, fixedOvertimePay: 45467 },
  { grade: 25, grossSalary: 356571, baseSalary: 310383, fixedOvertimePay: 46188 },
  { grade: 26, grossSalary: 362143, baseSalary: 315233, fixedOvertimePay: 46910 },
  { grade: 27, grossSalary: 367714, baseSalary: 320082, fixedOvertimePay: 47632 },
  { grade: 28, grossSalary: 373286, baseSalary: 324932, fixedOvertimePay: 48354 },
  { grade: 29, grossSalary: 378857, baseSalary: 329782, fixedOvertimePay: 49075 },
  { grade: 30, grossSalary: 384429, baseSalary: 334632, fixedOvertimePay: 49797 },
  { grade: 31, grossSalary: 390000, baseSalary: 339481, fixedOvertimePay: 50519 },
  { grade: 32, grossSalary: 395571, baseSalary: 344331, fixedOvertimePay: 51240 },
  { grade: 33, grossSalary: 401143, baseSalary: 349181, fixedOvertimePay: 51962 },
  { grade: 34, grossSalary: 406714, baseSalary: 354030, fixedOvertimePay: 52684 },
  { grade: 35, grossSalary: 412286, baseSalary: 358881, fixedOvertimePay: 53405 },
  { grade: 36, grossSalary: 417857, baseSalary: 363730, fixedOvertimePay: 54127 },
  { grade: 37, grossSalary: 423429, baseSalary: 368580, fixedOvertimePay: 54849 },
  { grade: 38, grossSalary: 429000, baseSalary: 373430, fixedOvertimePay: 55570 },
  { grade: 39, grossSalary: 434571, baseSalary: 378279, fixedOvertimePay: 56292 },
  { grade: 40, grossSalary: 440143, baseSalary: 383129, fixedOvertimePay: 57014 },
  { grade: 41, grossSalary: 445714, baseSalary: 387979, fixedOvertimePay: 57735 },
  { grade: 42, grossSalary: 451286, baseSalary: 392829, fixedOvertimePay: 58457 },
  { grade: 43, grossSalary: 456857, baseSalary: 397678, fixedOvertimePay: 59179 },
  { grade: 44, grossSalary: 462429, baseSalary: 402528, fixedOvertimePay: 59901 },
  { grade: 45, grossSalary: 468000, baseSalary: 407378, fixedOvertimePay: 60622 },
  { grade: 46, grossSalary: 473571, baseSalary: 412227, fixedOvertimePay: 61344 },
  { grade: 47, grossSalary: 479143, baseSalary: 417077, fixedOvertimePay: 62066 },
  { grade: 48, grossSalary: 484714, baseSalary: 421927, fixedOvertimePay: 62787 },
  { grade: 49, grossSalary: 490286, baseSalary: 426777, fixedOvertimePay: 63509 },
  { grade: 50, grossSalary: 495857, baseSalary: 431626, fixedOvertimePay: 64231 },
  { grade: 51, grossSalary: 501429, baseSalary: 436477, fixedOvertimePay: 64952 },
  { grade: 52, grossSalary: 507000, baseSalary: 441326, fixedOvertimePay: 65674 },
  { grade: 53, grossSalary: 512571, baseSalary: 446175, fixedOvertimePay: 66396 },
  { grade: 54, grossSalary: 518143, baseSalary: 451026, fixedOvertimePay: 67117 },
  { grade: 55, grossSalary: 523714, baseSalary: 455875, fixedOvertimePay: 67839 },
  { grade: 56, grossSalary: 529286, baseSalary: 460725, fixedOvertimePay: 68561 },
  { grade: 57, grossSalary: 534857, baseSalary: 465575, fixedOvertimePay: 69282 },
  { grade: 58, grossSalary: 540429, baseSalary: 470425, fixedOvertimePay: 70004 },
  { grade: 59, grossSalary: 546000, baseSalary: 475274, fixedOvertimePay: 70726 },
  { grade: 60, grossSalary: 551571, baseSalary: 480123, fixedOvertimePay: 71448 },
  { grade: 61, grossSalary: 557143, baseSalary: 484974, fixedOvertimePay: 72169 },
  { grade: 62, grossSalary: 562714, baseSalary: 489823, fixedOvertimePay: 72891 },
  { grade: 63, grossSalary: 568286, baseSalary: 494673, fixedOvertimePay: 73613 },
  { grade: 64, grossSalary: 573857, baseSalary: 499523, fixedOvertimePay: 74334 },
  { grade: 65, grossSalary: 579429, baseSalary: 504373, fixedOvertimePay: 75056 },
  { grade: 66, grossSalary: 585000, baseSalary: 509222, fixedOvertimePay: 75778 },
  { grade: 67, grossSalary: 590571, baseSalary: 514072, fixedOvertimePay: 76499 },
  { grade: 68, grossSalary: 596143, baseSalary: 518922, fixedOvertimePay: 77221 },
  { grade: 69, grossSalary: 601714, baseSalary: 523771, fixedOvertimePay: 77943 },
  { grade: 70, grossSalary: 607286, baseSalary: 528622, fixedOvertimePay: 78664 },
  { grade: 71, grossSalary: 612857, baseSalary: 533471, fixedOvertimePay: 79386 },
  { grade: 72, grossSalary: 618429, baseSalary: 538321, fixedOvertimePay: 80108 },
  { grade: 73, grossSalary: 624000, baseSalary: 543170, fixedOvertimePay: 80830 },
  { grade: 74, grossSalary: 629571, baseSalary: 548020, fixedOvertimePay: 81551 },
  { grade: 75, grossSalary: 635143, baseSalary: 552870, fixedOvertimePay: 82273 },
  { grade: 76, grossSalary: 640714, baseSalary: 557719, fixedOvertimePay: 82995 },
  { grade: 77, grossSalary: 646286, baseSalary: 562570, fixedOvertimePay: 83716 },
  { grade: 78, grossSalary: 651857, baseSalary: 567419, fixedOvertimePay: 84438 },
  { grade: 79, grossSalary: 657429, baseSalary: 572269, fixedOvertimePay: 85160 },
  { grade: 80, grossSalary: 663000, baseSalary: 577119, fixedOvertimePay: 85881 },
  { grade: 81, grossSalary: 668571, baseSalary: 581968, fixedOvertimePay: 86603 },
];

// 管理部メンバー（固定残業20H）
// 総支給239,000〜298,000（1,000円刻み）
const ADMIN_20H_GRADES: { grade: number; grossSalary: number; baseSalary: number; fixedOvertimePay: number }[] = [
  { grade: 1, grossSalary: 239000, baseSalary: 208041, fixedOvertimePay: 30959 },
  { grade: 2, grossSalary: 240000, baseSalary: 208911, fixedOvertimePay: 31089 },
  { grade: 3, grossSalary: 241000, baseSalary: 209782, fixedOvertimePay: 31218 },
  { grade: 4, grossSalary: 242000, baseSalary: 210652, fixedOvertimePay: 31348 },
  { grade: 5, grossSalary: 243000, baseSalary: 211523, fixedOvertimePay: 31477 },
  { grade: 6, grossSalary: 244000, baseSalary: 212393, fixedOvertimePay: 31607 },
  { grade: 7, grossSalary: 245000, baseSalary: 213264, fixedOvertimePay: 31736 },
  { grade: 8, grossSalary: 246000, baseSalary: 214134, fixedOvertimePay: 31866 },
  { grade: 9, grossSalary: 247000, baseSalary: 215005, fixedOvertimePay: 31995 },
  { grade: 10, grossSalary: 248000, baseSalary: 215875, fixedOvertimePay: 32125 },
  { grade: 11, grossSalary: 249000, baseSalary: 216746, fixedOvertimePay: 32254 },
  { grade: 12, grossSalary: 250000, baseSalary: 217616, fixedOvertimePay: 32384 },
  { grade: 13, grossSalary: 251000, baseSalary: 218487, fixedOvertimePay: 32513 },
  { grade: 14, grossSalary: 252000, baseSalary: 219357, fixedOvertimePay: 32643 },
  { grade: 15, grossSalary: 253000, baseSalary: 220227, fixedOvertimePay: 32773 },
  { grade: 16, grossSalary: 254000, baseSalary: 221098, fixedOvertimePay: 32902 },
  { grade: 17, grossSalary: 255000, baseSalary: 221968, fixedOvertimePay: 33032 },
  { grade: 18, grossSalary: 256000, baseSalary: 222839, fixedOvertimePay: 33161 },
  { grade: 19, grossSalary: 257000, baseSalary: 223709, fixedOvertimePay: 33291 },
  { grade: 20, grossSalary: 258000, baseSalary: 224580, fixedOvertimePay: 33420 },
  { grade: 21, grossSalary: 259000, baseSalary: 225450, fixedOvertimePay: 33550 },
  { grade: 22, grossSalary: 260000, baseSalary: 226321, fixedOvertimePay: 33679 },
  { grade: 23, grossSalary: 261000, baseSalary: 227191, fixedOvertimePay: 33809 },
  { grade: 24, grossSalary: 262000, baseSalary: 228062, fixedOvertimePay: 33938 },
  { grade: 25, grossSalary: 263000, baseSalary: 228932, fixedOvertimePay: 34068 },
  { grade: 26, grossSalary: 264000, baseSalary: 229803, fixedOvertimePay: 34197 },
  { grade: 27, grossSalary: 265000, baseSalary: 230673, fixedOvertimePay: 34327 },
  { grade: 28, grossSalary: 266000, baseSalary: 231544, fixedOvertimePay: 34456 },
  { grade: 29, grossSalary: 267000, baseSalary: 232414, fixedOvertimePay: 34586 },
  { grade: 30, grossSalary: 268000, baseSalary: 233284, fixedOvertimePay: 34716 },
  { grade: 31, grossSalary: 269000, baseSalary: 234155, fixedOvertimePay: 34845 },
  { grade: 32, grossSalary: 270000, baseSalary: 235025, fixedOvertimePay: 34975 },
  { grade: 33, grossSalary: 271000, baseSalary: 235896, fixedOvertimePay: 35104 },
  { grade: 34, grossSalary: 272000, baseSalary: 236766, fixedOvertimePay: 35234 },
  { grade: 35, grossSalary: 273000, baseSalary: 237637, fixedOvertimePay: 35363 },
  { grade: 36, grossSalary: 274000, baseSalary: 238507, fixedOvertimePay: 35493 },
  { grade: 37, grossSalary: 275000, baseSalary: 239378, fixedOvertimePay: 35622 },
  { grade: 38, grossSalary: 276000, baseSalary: 240248, fixedOvertimePay: 35752 },
  { grade: 39, grossSalary: 277000, baseSalary: 241119, fixedOvertimePay: 35881 },
  { grade: 40, grossSalary: 278000, baseSalary: 241989, fixedOvertimePay: 36011 },
  { grade: 41, grossSalary: 279000, baseSalary: 242860, fixedOvertimePay: 36140 },
  { grade: 42, grossSalary: 280000, baseSalary: 243730, fixedOvertimePay: 36270 },
  { grade: 43, grossSalary: 281000, baseSalary: 244601, fixedOvertimePay: 36399 },
  { grade: 44, grossSalary: 282000, baseSalary: 245471, fixedOvertimePay: 36529 },
  { grade: 45, grossSalary: 283000, baseSalary: 246341, fixedOvertimePay: 36659 },
  { grade: 46, grossSalary: 284000, baseSalary: 247212, fixedOvertimePay: 36788 },
  { grade: 47, grossSalary: 285000, baseSalary: 248082, fixedOvertimePay: 36918 },
  { grade: 48, grossSalary: 286000, baseSalary: 248953, fixedOvertimePay: 37047 },
  { grade: 49, grossSalary: 287000, baseSalary: 249823, fixedOvertimePay: 37177 },
  { grade: 50, grossSalary: 288000, baseSalary: 250694, fixedOvertimePay: 37306 },
  { grade: 51, grossSalary: 289000, baseSalary: 251564, fixedOvertimePay: 37436 },
  { grade: 52, grossSalary: 290000, baseSalary: 252435, fixedOvertimePay: 37565 },
  { grade: 53, grossSalary: 291000, baseSalary: 253305, fixedOvertimePay: 37695 },
  { grade: 54, grossSalary: 292000, baseSalary: 254176, fixedOvertimePay: 37824 },
  { grade: 55, grossSalary: 293000, baseSalary: 255046, fixedOvertimePay: 37954 },
  { grade: 56, grossSalary: 294000, baseSalary: 255917, fixedOvertimePay: 38083 },
  { grade: 57, grossSalary: 295000, baseSalary: 256787, fixedOvertimePay: 38213 },
  { grade: 58, grossSalary: 296000, baseSalary: 257658, fixedOvertimePay: 38342 },
  { grade: 59, grossSalary: 297000, baseSalary: 258528, fixedOvertimePay: 38472 },
  { grade: 60, grossSalary: 298000, baseSalary: 259398, fixedOvertimePay: 38602 },
];

// 管理部主任以上（固定残業40H = 時間外30h + 深夜10h）
// 総支給290,500〜379,000
const ADMIN_40H_GRADES: { grade: number; grossSalary: number; baseSalary: number; fixedOvertimePay: number; positionAllowance: number }[] = [
  { grade: 1, grossSalary: 290500, baseSalary: 206321, fixedOvertimePay: 74179, positionAllowance: 10000 },
  { grade: 2, grossSalary: 292000, baseSalary: 206689, fixedOvertimePay: 74311, positionAllowance: 11000 },
  { grade: 3, grossSalary: 293500, baseSalary: 207057, fixedOvertimePay: 74443, positionAllowance: 12000 },
  { grade: 4, grossSalary: 295000, baseSalary: 207425, fixedOvertimePay: 74575, positionAllowance: 13000 },
  { grade: 5, grossSalary: 296500, baseSalary: 207792, fixedOvertimePay: 74708, positionAllowance: 14000 },
  { grade: 6, grossSalary: 298500, baseSalary: 208528, fixedOvertimePay: 74972, positionAllowance: 15000 },
  { grade: 7, grossSalary: 303000, baseSalary: 211838, fixedOvertimePay: 76162, positionAllowance: 15000 },
  { grade: 8, grossSalary: 305000, baseSalary: 212573, fixedOvertimePay: 76427, positionAllowance: 16000 },
  { grade: 9, grossSalary: 307000, baseSalary: 213309, fixedOvertimePay: 76691, positionAllowance: 17000 },
  { grade: 10, grossSalary: 309000, baseSalary: 214044, fixedOvertimePay: 76956, positionAllowance: 18000 },
  { grade: 11, grossSalary: 311000, baseSalary: 214780, fixedOvertimePay: 77220, positionAllowance: 19000 },
  { grade: 12, grossSalary: 313000, baseSalary: 215515, fixedOvertimePay: 77485, positionAllowance: 20000 },
  { grade: 13, grossSalary: 315000, baseSalary: 216251, fixedOvertimePay: 77749, positionAllowance: 21000 },
  { grade: 14, grossSalary: 317000, baseSalary: 216986, fixedOvertimePay: 78014, positionAllowance: 22000 },
  { grade: 15, grossSalary: 319000, baseSalary: 217722, fixedOvertimePay: 78278, positionAllowance: 23000 },
  { grade: 16, grossSalary: 321000, baseSalary: 218457, fixedOvertimePay: 78543, positionAllowance: 24000 },
  { grade: 17, grossSalary: 323000, baseSalary: 219193, fixedOvertimePay: 78807, positionAllowance: 25000 },
  { grade: 18, grossSalary: 325000, baseSalary: 219928, fixedOvertimePay: 79072, positionAllowance: 26000 },
  { grade: 19, grossSalary: 326000, baseSalary: 219928, fixedOvertimePay: 79072, positionAllowance: 27000 },
  { grade: 20, grossSalary: 339000, baseSalary: 227285, fixedOvertimePay: 81715, positionAllowance: 30000 },
  { grade: 21, grossSalary: 344000, baseSalary: 229491, fixedOvertimePay: 82509, positionAllowance: 32000 },
  { grade: 22, grossSalary: 349000, baseSalary: 231698, fixedOvertimePay: 83302, positionAllowance: 34000 },
  { grade: 23, grossSalary: 354000, baseSalary: 233904, fixedOvertimePay: 84096, positionAllowance: 36000 },
  { grade: 24, grossSalary: 359000, baseSalary: 236111, fixedOvertimePay: 84889, positionAllowance: 38000 },
  { grade: 25, grossSalary: 364000, baseSalary: 238317, fixedOvertimePay: 85683, positionAllowance: 40000 },
  { grade: 26, grossSalary: 369000, baseSalary: 240524, fixedOvertimePay: 86476, positionAllowance: 42000 },
  { grade: 27, grossSalary: 374000, baseSalary: 242731, fixedOvertimePay: 87269, positionAllowance: 44000 },
  { grade: 28, grossSalary: 379000, baseSalary: 244937, fixedOvertimePay: 88063, positionAllowance: 46000 },
];

async function main() {
  console.log('Seeding salary grades...');

  // 既存データを削除
  await prisma.salaryGrade.deleteMany();

  // SES事業部
  for (const g of SES_GRADES) {
    await prisma.salaryGrade.create({
      data: {
        department: 'ses',
        grade: g.grade,
        overtimeType: 20,
        grossSalary: g.grossSalary,
        baseSalary: g.baseSalary,
        fixedOvertimePay: g.fixedOvertimePay,
        positionAllowance: 0,
      },
    });
  }
  console.log(`  SES: ${SES_GRADES.length} grades`);

  // 管理部 20H
  for (const g of ADMIN_20H_GRADES) {
    await prisma.salaryGrade.create({
      data: {
        department: 'admin',
        grade: g.grade,
        overtimeType: 20,
        grossSalary: g.grossSalary,
        baseSalary: g.baseSalary,
        fixedOvertimePay: g.fixedOvertimePay,
        positionAllowance: 0,
      },
    });
  }
  console.log(`  Admin 20H: ${ADMIN_20H_GRADES.length} grades`);

  // 管理部 40H
  for (const g of ADMIN_40H_GRADES) {
    await prisma.salaryGrade.create({
      data: {
        department: 'admin',
        grade: g.grade,
        overtimeType: 40,
        grossSalary: g.grossSalary,
        baseSalary: g.baseSalary,
        fixedOvertimePay: g.fixedOvertimePay,
        positionAllowance: g.positionAllowance,
      },
    });
  }
  console.log(`  Admin 40H: ${ADMIN_40H_GRADES.length} grades`);

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
