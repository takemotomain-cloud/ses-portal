/**
 * ルートページ（/）
 *
 * 認証状態に応じてリダイレクトする。
 * - 未ログイン → /login
 * - ログイン済み(employee) → /mypage
 * - ログイン済み(admin/sales/accounting) → /admin/dashboard
 *
 * 本番ではmiddleware.tsでサーバーサイドリダイレクトに変更する。
 */

import { redirect } from 'next/navigation';

export default function Home() {
  // Phase 1初期: ログイン画面にリダイレクト
  // 認証連携後はセッション確認 → ロール別リダイレクトに変更
  redirect('/login');
}
