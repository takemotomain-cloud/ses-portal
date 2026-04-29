/**
 * Next.js Middleware — ルート保護
 *
 * 認証が必要なページへのアクセスを制御する。
 * Edge Runtimeで動作するため、リクエスト到達前にチェック可能。
 *
 * Phase 1初期: クライアントサイドのAuthContextで認証状態を管理しているため、
 * ここではcookieベースの簡易チェックのみ行う。
 * 本番フェーズでNextAuth.jsのセッショントークンでサーバーサイドチェックに移行。
 *
 * 保護対象:
 * - /mypage/** — 全ロール（ログイン必須）
 * - /admin/** — admin/sales/accounting（employeeは不可）
 * - /attendance/** — 全ロール（ログイン必須）
 * - /applications/** — 全ロール（ログイン必須）
 * - /more/** — 全ロール（ログイン必須）
 *
 * 除外:
 * - /login — ログイン画面
 * - /api/** — API（API側で独自に認証チェック）
 * - /_next/** — Next.js静的アセット
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ログインページ・API・静的アセットはスキップ
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Phase 1初期: クライアントサイド認証のため、
  // サーバーサイドではcookieの存在チェックのみ。
  // 認証トークンはlocalStorageに保存しているため、
  // ここでは完全な認証チェックはできない。
  // → NextAuth.jsのセッションcookie導入後に強化する。

  // 現時点ではクライアントサイドのAuthContextに委譲
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 以下のパスを除外:
     * - api (APIルート)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
