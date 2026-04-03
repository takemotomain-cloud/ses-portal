/**
 * SES Portal — 共有定数
 *
 * フロントエンド・バックエンド両方で使う定数。
 * UIのデザインルール（日付形式等）やビジネスロジック定数を集約。
 */

/** 日付フォーマット: 「○年○月○日」形式統一（スラッシュ禁止） */
export const DATE_FORMAT = 'YYYY年M月D日';

/** 金額: カンマ区切り全桁表示（M/K省略禁止） */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP') + '円';
}

/** 所定労働時間（分） */
export const STANDARD_WORK_MINUTES = 480; // 8時間

/** デフォルト休憩時間（分） */
export const DEFAULT_BREAK_MINUTES = 60;

/** アカウントロックまでのログイン失敗回数 */
export const MAX_LOGIN_ATTEMPTS = 5;

/** JWTトークン有効期限 */
export const JWT_EXPIRY = '24h';

/** リフレッシュトークン有効期限 */
export const REFRESH_TOKEN_EXPIRY = '7d';

/** bcrypt のコストファクター */
export const BCRYPT_ROUNDS = 12;

/**
 * エリア判定マッピング
 * 勤務地からエリアを自動判定するための地名マッピング。
 * assignments.areaの自動設定に使用。
 */
export const AREA_MAPPING: Record<string, string> = {
  // 東京エリア
  '東京': 'tokyo',
  '横浜': 'tokyo',
  '千葉': 'tokyo',
  '埼玉': 'tokyo',
  '神奈川': 'tokyo',
  // 大阪エリア
  '大阪': 'osaka',
  '京都': 'osaka',
  '神戸': 'osaka',
  '兵庫': 'osaka',
  '奈良': 'osaka',
  '滋賀': 'osaka',
  // 名古屋エリア
  '名古屋': 'nagoya',
  '愛知': 'nagoya',
  '静岡': 'nagoya',
  '岐阜': 'nagoya',
  '三重': 'nagoya',
};

/**
 * 勤務地文字列からエリアを判定する
 * @param location 勤務地（例: "東京都港区"）
 * @returns エリアコード or null
 */
export function detectArea(location: string): string | null {
  for (const [keyword, area] of Object.entries(AREA_MAPPING)) {
    if (location.includes(keyword)) {
      return area;
    }
  }
  return null;
}

/** ページネーションのデフォルト値 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
