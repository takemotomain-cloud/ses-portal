/**
 * 社員マイページ ヘッダー
 *
 * UIモック準拠:
 * - メインタブ（ホーム/勤怠/申請/その他）→ ロゴ表示
 * - サブページ → 「‹ ページ名」の戻るナビゲーション
 * - 右側に社員名をグレーテキストで表示
 */

'use client';

import { useAuth } from '@/lib/auth-context';

export function EmployeeHeader() {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 h-header bg-card border-b border-border flex items-center justify-between px-4 z-50">
      <div className="flex flex-col">
        <span className="text-base font-bold text-primary tracking-tight">
          {user?.tenantName || 'SES Portal'}
        </span>
        <span className="text-[9px] text-secondary font-semibold uppercase tracking-[0.15em]">
          User Portal
        </span>
      </div>

      {/* ユーザー名 */}
      <span className="text-sm text-secondary">
        {user?.name || ''}
      </span>
    </header>
  );
}
