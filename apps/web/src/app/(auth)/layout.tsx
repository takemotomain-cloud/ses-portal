/**
 * 認証レイアウト
 *
 * ログイン画面用のレイアウト。
 * ナビゲーション（ヘッダー/サイドバー/ボトムナビ）を一切表示しない。
 * AuthProviderは認証状態のチェックに必要なので含める。
 */

import { AuthProvider } from '@/lib/auth-context';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
