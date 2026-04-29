/**
 * 標準報酬月額テーブル（令和6年度 / 全国健康保険協会・厚生年金）
 * 50等級（健康保険1〜50等級、厚生年金1〜32等級）
 */

interface StandardRemunerationGrade {
  grade: number;        // 等級
  lowerBound: number;   // 報酬月額下限（以上）
  upperBound: number;   // 報酬月額上限（未満）、最終等級は Infinity
  standardAmount: number; // 標準報酬月額
}

export const STANDARD_REMUNERATION_TABLE: StandardRemunerationGrade[] = [
  { grade: 1,  lowerBound: 0,       upperBound: 63000,   standardAmount: 58000 },
  { grade: 2,  lowerBound: 63000,   upperBound: 73000,   standardAmount: 68000 },
  { grade: 3,  lowerBound: 73000,   upperBound: 83000,   standardAmount: 78000 },
  { grade: 4,  lowerBound: 83000,   upperBound: 93000,   standardAmount: 88000 },
  { grade: 5,  lowerBound: 93000,   upperBound: 101000,  standardAmount: 98000 },
  { grade: 6,  lowerBound: 101000,  upperBound: 107000,  standardAmount: 104000 },
  { grade: 7,  lowerBound: 107000,  upperBound: 114000,  standardAmount: 110000 },
  { grade: 8,  lowerBound: 114000,  upperBound: 122000,  standardAmount: 118000 },
  { grade: 9,  lowerBound: 122000,  upperBound: 130000,  standardAmount: 126000 },
  { grade: 10, lowerBound: 130000,  upperBound: 138000,  standardAmount: 134000 },
  { grade: 11, lowerBound: 138000,  upperBound: 146000,  standardAmount: 142000 },
  { grade: 12, lowerBound: 146000,  upperBound: 155000,  standardAmount: 150000 },
  { grade: 13, lowerBound: 155000,  upperBound: 165000,  standardAmount: 160000 },
  { grade: 14, lowerBound: 165000,  upperBound: 175000,  standardAmount: 170000 },
  { grade: 15, lowerBound: 175000,  upperBound: 185000,  standardAmount: 180000 },
  { grade: 16, lowerBound: 185000,  upperBound: 195000,  standardAmount: 190000 },
  { grade: 17, lowerBound: 195000,  upperBound: 210000,  standardAmount: 200000 },
  { grade: 18, lowerBound: 210000,  upperBound: 230000,  standardAmount: 220000 },
  { grade: 19, lowerBound: 230000,  upperBound: 250000,  standardAmount: 240000 },
  { grade: 20, lowerBound: 250000,  upperBound: 270000,  standardAmount: 260000 },
  { grade: 21, lowerBound: 270000,  upperBound: 290000,  standardAmount: 280000 },
  { grade: 22, lowerBound: 290000,  upperBound: 310000,  standardAmount: 300000 },
  { grade: 23, lowerBound: 310000,  upperBound: 330000,  standardAmount: 320000 },
  { grade: 24, lowerBound: 330000,  upperBound: 350000,  standardAmount: 340000 },
  { grade: 25, lowerBound: 350000,  upperBound: 370000,  standardAmount: 360000 },
  { grade: 26, lowerBound: 370000,  upperBound: 395000,  standardAmount: 380000 },
  { grade: 27, lowerBound: 395000,  upperBound: 425000,  standardAmount: 410000 },
  { grade: 28, lowerBound: 425000,  upperBound: 455000,  standardAmount: 440000 },
  { grade: 29, lowerBound: 455000,  upperBound: 485000,  standardAmount: 470000 },
  { grade: 30, lowerBound: 485000,  upperBound: 515000,  standardAmount: 500000 },
  { grade: 31, lowerBound: 515000,  upperBound: 545000,  standardAmount: 530000 },
  { grade: 32, lowerBound: 545000,  upperBound: 575000,  standardAmount: 560000 },
  { grade: 33, lowerBound: 575000,  upperBound: 605000,  standardAmount: 590000 },
  { grade: 34, lowerBound: 605000,  upperBound: 635000,  standardAmount: 620000 },
  { grade: 35, lowerBound: 635000,  upperBound: 665000,  standardAmount: 650000 },
  { grade: 36, lowerBound: 665000,  upperBound: 695000,  standardAmount: 680000 },
  { grade: 37, lowerBound: 695000,  upperBound: 730000,  standardAmount: 710000 },
  { grade: 38, lowerBound: 730000,  upperBound: 770000,  standardAmount: 750000 },
  { grade: 39, lowerBound: 770000,  upperBound: 810000,  standardAmount: 790000 },
  { grade: 40, lowerBound: 810000,  upperBound: 855000,  standardAmount: 830000 },
  { grade: 41, lowerBound: 855000,  upperBound: 905000,  standardAmount: 880000 },
  { grade: 42, lowerBound: 905000,  upperBound: 955000,  standardAmount: 930000 },
  { grade: 43, lowerBound: 955000,  upperBound: 1005000, standardAmount: 980000 },
  { grade: 44, lowerBound: 1005000, upperBound: 1055000, standardAmount: 1030000 },
  { grade: 45, lowerBound: 1055000, upperBound: 1115000, standardAmount: 1090000 },
  { grade: 46, lowerBound: 1115000, upperBound: 1175000, standardAmount: 1150000 },
  { grade: 47, lowerBound: 1175000, upperBound: 1235000, standardAmount: 1210000 },
  { grade: 48, lowerBound: 1235000, upperBound: 1295000, standardAmount: 1270000 },
  { grade: 49, lowerBound: 1295000, upperBound: 1355000, standardAmount: 1330000 },
  { grade: 50, lowerBound: 1355000, upperBound: Infinity, standardAmount: 1390000 },
];

/** 報酬月額から等級を検索 */
export function findGrade(monthlyRemuneration: number): { grade: number; standardAmount: number } {
  const row = STANDARD_REMUNERATION_TABLE.find(
    (r) => monthlyRemuneration >= r.lowerBound && monthlyRemuneration < r.upperBound,
  );
  // fallback to top grade
  const found = row ?? STANDARD_REMUNERATION_TABLE[STANDARD_REMUNERATION_TABLE.length - 1];
  return { grade: found.grade, standardAmount: found.standardAmount };
}

// デフォルト: 東京都 令和6年度 協会けんぽ 9.98%（折半 4.99%）
const DEFAULT_HEALTH_INSURANCE_RATE = 0.0499;
// 厚生年金 18.3%（折半 9.15%）
const PENSION_RATE = 0.0915;

/** 健康保険料（被保険者負担分）— rate は RateMaster.healthInsuranceStdRate から取得 */
export function calcHealthInsurance(standardAmount: number, rate: number = DEFAULT_HEALTH_INSURANCE_RATE): number {
  return Math.round(standardAmount * rate);
}

/** 介護保険料（被保険者負担分・40歳以上65歳未満） */
export function calcNursingCareInsurance(standardAmount: number, rate: number): number {
  return Math.round(standardAmount * rate);
}

/** 厚生年金保険料（被保険者負担分）— 上限: 等級32（650,000円） */
export function calcPension(standardAmount: number): number {
  const pensionCap = 650000;
  const capped = Math.min(standardAmount, pensionCap);
  return Math.round(capped * PENSION_RATE);
}
