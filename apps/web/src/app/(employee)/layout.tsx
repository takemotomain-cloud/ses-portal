/**
 * 社員マイページ レイアウト
 *
 * スマホファースト設計。ヘッダー + ボトムナビ + コンテンツエリア。
 * UIモックのemployee-portal.htmlの構造を再現。
 *
 * ナビゲーション構成（UIモック準拠）:
 * - ヘッダー: ロゴ（メインタブ）or 戻るナビ（サブページ）+ 社員名
 * - ボトムナビ: ホーム / 勤怠 / 申請 / その他
 *
 * 注意: このレイアウトはログイン済み社員のみアクセス可能。
 * middleware.tsで未認証ユーザーはログインにリダイレクト。
 */

import { AuthProvider } from '@/lib/auth-context';
import { BottomNav } from '@/components/layout/bottom-nav';
import { EmployeeHeader } from '@/components/layout/employee-header';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-page">
        <EmployeeHeader />
        <main className="pt-[calc(56px+1.25rem)] pb-[calc(var(--bottom-nav-height,64px)+env(safe-area-inset-bottom,0px)+1.25rem)] max-w-content mx-auto px-4">
          {children}
        </main>
        <BottomNav />
      </div>
    </AuthProvider>
  );
}
