/**
 * 管理画面 レイアウト
 *
 * PCファースト設計。サイドナビ(220px) + メインエリア。
 * UIモックのses_portal_all.htmlの構造を再現。
 *
 * レスポンシブ: 1024px以下でハンバーガーメニュー切替。
 * E: ロール制限 — 管理側ログインの admin/manager/member のみアクセス可（employee は /mypage へ）。
 */

import { AuthProvider } from '@/lib/auth-context';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminProviders } from '@/components/layout/admin-providers';
import { AuthGuard } from '@/components/ui/auth-guard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminProviders>
        <AuthGuard requiredRoles={['admin', 'manager', 'member']}>
          <div className="min-h-screen bg-page">
            <AdminSidebar />
            <main className="ml-0 lg:ml-sidebar p-4 lg:p-7 min-h-screen">
              {children}
            </main>
          </div>
        </AuthGuard>
      </AdminProviders>
    </AuthProvider>
  );
}
