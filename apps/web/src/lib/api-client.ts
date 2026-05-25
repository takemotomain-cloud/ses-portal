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

/** 旧実装との互換用: localStorage に残った古いトークンを消す */
const LEGACY_TOKEN_KEY = 'ses_portal_token';

export function getToken(): string | null {
  return null;
}

export function setToken(_token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
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
      // ログインページ（共通/テナント別）以外にいる場合のみリダイレクト
      const isLoginPage = 
        window.location.pathname === '/login' || 
        window.location.pathname.endsWith('/login');
        
      if (!isLoginPage) {
        // 現在のURLからテナントコード（/t/subdomain/...）を抽出
        const pathname = window.location.pathname;
        const tenantMatch = pathname.match(/^\/t\/([^\/]+)/);
        if (tenantMatch) {
          window.location.href = `/t/${tenantMatch[1]}/login`;
        } else {
          window.location.href = '/login';
        }
      }
    }

    throw error;
  }

  return body as T;
}
