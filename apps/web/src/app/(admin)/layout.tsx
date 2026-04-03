/**
 * 管理画面 レイアウト
 *
 * PCファースト設計。サイドナビ(220px) + メインエリア。
 * UIモックのses_portal_all.htmlの構造を再現。
 *
 * レスポンシブ: 1024px以下でハンバーガーメニュー切替。
 * ロール制限: admin/sales/accountingのみアクセス可能。
 */

import { AuthProvider } from '@/lib/auth-context';
import { AdminSidebar } from '@/components/layout/admin-sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-page">
        <AdminSidebar />
        <main className="ml-0 lg:ml-sidebar p-4 lg:p-7 min-h-screen">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
