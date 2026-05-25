/**
 * MCP → NestJS API クライアント
 *
 * MCPサーバーからNestJS APIにリクエストを送るためのユーティリティ。
 * 環境変数からAPI URLとJWTトークンを取得する。
 *
 * セキュリティ:
 * - JWTトークンは環境変数で管理（コードにハードコードしない）
 * - 管理者権限のトークンのみ想定
 * - エラーレスポンスは適切にハンドリングしてClaudeに返す
 */

const API_URL = process.env.SES_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.SES_API_TOKEN || '';

/**
 * NestJS APIにリクエストを送信する
 *
 * @param method HTTPメソッド
 * @param path APIパス（例: '/employees', '/attendance/2026/4'）
 * @param body リクエストボディ（POST/PATCH用）
 * @returns APIレスポンスのJSON
 * @throws エラー時はメッセージ付きで例外を投げる
 */
export async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: any,
): Promise<any> {
  if (!API_TOKEN) {
    throw new Error(
      'SES_API_TOKEN が設定されていません。' +
      '環境変数に管理者のJWTトークンを設定してください。'
    );
  }

  const url = `${API_URL}/api${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || `APIエラー (${response.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * 日付をAPIパラメータ用にフォーマットする
 * 「2026年4月」→ { year: 2026, month: 4 }
 */
export function parseYearMonth(input: string): { year: number; month: number } {
  // "2026年4月" or "2026/4" or "2026-04" に対応
  const match = input.match(/(\d{4})\D+(\d{1,2})/);
  if (!match) {
    throw new Error(`日付の形式が正しくありません: ${input}。「2026年4月」のように入力してください。`);
  }
  return { year: parseInt(match[1]), month: parseInt(match[2]) };
}

/**
 * 金額を読みやすい形式にフォーマットする
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP') + '円';
}

/**
 * 分を「○時間○分」形式にフォーマットする
 */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}
