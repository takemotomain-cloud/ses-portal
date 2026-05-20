/**
 * System管理者ポータル レイアウト
 * 通常の管理画面（/admin）とは完全に分離した独立レイアウト。
 * 認証はURLシークレットキー方式。
 * ※ html/body タグはルートレイアウト(app/layout.tsx)が担うため不要
 */
export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      {children}
    </div>
  );
}
