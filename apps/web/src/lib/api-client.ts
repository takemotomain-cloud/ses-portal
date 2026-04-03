/**
 * API Client
 *
 * NestJS APIとの通信を一元化するfetchラッパー。
 * 認証トークンの付与・レスポンスのパース・エラーハンドリングを統一。
 *
 * なぜfetch直接ではなくラッパー:
 * - Authorizationヘッダーの付与を忘れない
 * - エラーレスポンスの形式を統一
 * - API URLの変更が1箇所で済む
 *
 * 注意: next.config.jsのrewritesでAPIリクエストを転送するため、
 * クライアント側ではベースURLなし（/api/... で直接呼べる）
 */

import type { ApiError } from '@ses-portal/shared';

/** ローカルストレージのトークンキー */
const TOKEN_KEY = 'ses_portal_token';

/**
 * 認証トークンを取得
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 認証トークンを保存
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 認証トークンを削除（ログアウト時）
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * APIリクエストを送信する
 *
 * @param path APIパス（例: '/auth/login', '/employees'）
 * @param options fetchのオプション
 * @returns パース済みレスポンス
 * @throws ApiError API側でエラーが返された場合
 *
 * 障害パターン:
 * - ネットワークエラー → fetchが例外を投げる → 呼び出し側でcatch
 * - 401 → トークン無効 → ログイン画面にリダイレクト
 * - 403 → 権限不足 → エラーメッセージ表示
 * - 500 → サーバーエラー → 汎用エラーメッセージ表示
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // 認証トークンがあればAuthorizationヘッダーに付与
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  // レスポンスボディのパース
  const body = await response.json().catch(() => null);

  // エラーレスポンスの処理
  if (!response.ok) {
    const error: ApiError = {
      statusCode: response.status,
      message: body?.message || 'エラーが発生しました',
      error: body?.error,
    };

    // 401: トークン無効 → ログイン画面にリダイレクト
    if (response.status === 401 && typeof window !== 'undefined') {
      removeToken();
      // ログインページ以外にいる場合のみリダイレクト
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    throw error;
  }

  return body as T;
}
