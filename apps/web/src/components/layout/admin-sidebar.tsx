/**
 * 管理画面 サイドバー
 *
 * UIモック準拠のサイドナビゲーション。
 * セクション: アラート / 営業 / 人事・労務 / 採用 / 経理・管理 / 設定
 * 1024px以下でハンバーガーメニューに切替。
 *
 * ロールベース表示:
 * - admin: 全セクション表示
 * - sales: 営業セクションのみ
 * - accounting: 経理・管理セクションのみ
 * （Phase 1初期は全表示、ロール制御は段階的に追加）
 */

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useNavigationGuard } from '@/lib/navigation-guard';

interface NavSection {
  label: string;
  items: { label: string; href: string; badge?: number }[];
}

const navSections: NavSection[] = [
  {
    label: 'アラート',
    items: [
      { label: '本日', href: '/admin/alerts/today' },
      { label: '今月', href: '/admin/alerts/month' },
      { label: '通知', href: '/admin/notifications' },
    ],
  },
  {
    label: '営業',
    items: [
      { label: 'ダッシュボード', href: '/admin/dashboard' },
      { label: '稼働管理', href: '/admin/assignments' },
      { label: '営業管理', href: '/admin/sales' },
      { label: 'スキルシート', href: '/admin/skillsheets' },
      { label: 'クライアント', href: '/admin/clients' },
      { label: '商談ログ', href: '/admin/deals' },
    ],
  },
  {
    label: '人事・労務',
    items: [
      { label: '社員一覧', href: '/admin/employees' },
      { label: '勤怠管理', href: '/admin/attendance' },
      { label: '給与管理', href: '/admin/payroll' },
      { label: '承認待ち', href: '/admin/approvals' },
      { label: '通知書（入社前）', href: '/admin/notices' },
      { label: '通知書（無期転換）', href: '/admin/notices-muki' },
      { label: '入社予定社員', href: '/admin/onboarding' },
      { label: 'お知らせ配信', href: '/admin/announcements' },
    ],
  },
  {
    label: '採用',
    items: [
      { label: '採用ダッシュボード', href: '/admin/recruit-dash' },
      { label: '月次進捗', href: '/admin/recruit-progress' },
      { label: '候補者一覧', href: '/admin/recruit-candidates' },
      { label: '応募経路', href: '/admin/recruit-sources' },
      { label: 'アナリティクス', href: '/admin/recruit-analytics' },
      { label: 'キャンペーン分析', href: '/admin/recruit-campaign' },
      { label: '予算', href: '/admin/recruit-budget' },
      { label: '採用設定', href: '/admin/recruit-settings' },
    ],
  },
  {
    label: '経理・管理',
    items: [
      { label: '経費精算', href: '/admin/expenses' },
      { label: '請求管理', href: '/admin/billing' },
      { label: '契約書', href: '/admin/contracts' },
      { label: '就業規則', href: '/admin/rules' },
      { label: 'freee連携', href: '/admin/freee' },
    ],
  },
  {
    label: '設定',
    items: [{ label: '設定', href: '/admin/settings' }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { confirmNavigation } = useNavigationGuard();

  const [approvalCount, setApprovalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // 承認待ち件数 / 未読通知件数 を API から取得
  useEffect(() => {
    async function fetchCounts() {
      try {
        const [leaves, expenses, changes, delayCerts, unread] = await Promise.all([
          apiClient<any[]>('/leave/pending').catch(() => []),
          apiClient<any[]>('/expense/pending').catch(() => []),
          apiClient<any[]>('/profile/change-requests/pending').catch(() => []),
          apiClient<any[]>('/delay-certificates/pending').catch(() => []),
          apiClient<{ count: number }>('/notifications/unread-count?audience=admin').catch(() => ({ count: 0 })),
        ]);
        setApprovalCount(leaves.length + expenses.length + changes.length + delayCerts.length);
        setUnreadCount(unread.count || 0);
      } catch {
        setApprovalCount(0);
        setUnreadCount(0);
      }
    }
    fetchCounts();
    // 30秒ごとに再取得
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* サイドバー本体 */}
      <aside
        className="fixed top-0 h-screen w-sidebar bg-card border-r border-border/30
                    flex flex-col py-6 overflow-y-auto z-[200]
                    hidden lg:flex lg:left-0"
      >
        {/* ロゴ */}
        <div className="px-5 pb-6">
          <Link href="/admin/dashboard">
            <svg className="h-10 w-auto" viewBox="0 0 1050 400" xmlns="http://www.w3.org/2000/svg">
              <path fill="#2f2f2f" d="M951.79,306.82l-2.1-23.01c-17.52,31.29-60.89,32.53-88.67,17.23-10.45-5.75-18.68-14.17-25.03-24.09-9.94-15.51-13.25-32.91-12.98-51.26.7-47.36,33.06-83.05,81.2-80.29,19.44,1.11,36.24,8.99,45.67,26.37l1.78-23.03h30.15s-.02,157.93-.02,157.93l-29.99.16ZM905.82,283.83c16.43-.81,30.36-9.55,37.73-23.85,10.4-20.17,10.27-44.4-.11-64.47-8.38-16.22-24.32-24.39-42.25-23.73s-33.64,10.82-40.85,28.05c-7.58,18.11-7.63,39.1.4,57.13,7.98,17.92,25.06,27.85,45.07,26.87Z" />
              <path fill="#2f2f2f" d="M300.54,285.04c21.34,2.82,42.04-4.83,51.29-25.34l31.49.05c-4.48,13.09-11.45,24.57-21.9,33.42-21.43,18.16-53.98,21.24-80.45,13.41-49.72-14.7-64.87-70.58-46.86-114.69,7.59-18.6,21.83-32.25,40.05-40.08,13.41-5.77,27.15-7.08,41.79-6.26,11.46.64,21.86,3.9,31.98,9.26,29.98,15.89,41.63,50.35,38.31,82.6l-127.43-.02c1.17,25.3,17.37,44.42,41.74,47.64ZM354.02,214.37c-.91-10.03-4.03-18.45-8.83-26.11-12.35-19.19-40.64-22.81-59.31-13.67-15.32,7.5-24.92,22.95-26.23,39.94l94.37-.16Z" />
              <polygon fill="#2f2f2f" points="604.07 306.75 542.32 148.72 576.21 148.77 623.3 275.47 686.02 111.05 756.6 89.38 756.48 117.11 711.08 131.17 642.38 306.71 604.07 306.75" />
              <polygon fill="#2f2f2f" points="208.15 277.7 208.25 306.75 68.21 306.72 68.22 93.71 100.22 93.72 100.2 277.75 208.15 277.7" />
              <path fill="#2f2f2f" d="M456.5,220.2l-.29,86.59-31.75-.13.05-157.86,29.86-.14,1.3,25.32c11.25-25.08,35.87-32.08,61.49-27.06l.09,29.24c-20.26-3.7-42.54-3.17-53.4,17.25-4.13,7.76-7.31,16.95-7.34,26.79Z" />
              <polygon fill="#2f2f2f" points="784.98 306.56 753.89 306.81 753.87 148.73 784.96 148.72 784.98 306.56" />
            </svg>
          </Link>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1">
          {navSections.map((section) => (
            <div key={section.label} className="px-3 mb-4">
              <div className="text-2xs text-secondary/60 uppercase tracking-widest px-2 mb-1">
                {section.label}
              </div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const dynamicBadge =
                  item.href === '/admin/approvals' ? approvalCount :
                  item.href === '/admin/notifications' ? unreadCount : 0;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirmNavigation()) router.push(item.href);
                    }}
                    className={`flex items-center justify-between px-3 py-[7px] rounded-md
                               text-base transition-colors cursor-pointer
                               ${active
                                 ? 'bg-accent text-accent-text font-medium'
                                 : 'text-secondary hover:bg-page hover:text-primary'
                               }`}
                  >
                    <span>{item.label}</span>
                    {dynamicBadge > 0 && (
                      <span className="bg-status-red-bg text-status-red-text text-2xs px-1.5 py-px rounded-full">
                        {dynamicBadge}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          ))}

          {/* マイページへのリンク */}
          <div className="px-3 mb-4">
            <div className="text-2xs text-secondary/60 uppercase tracking-widest px-2 mb-1">
              マイページ
            </div>
            <a
              href="/mypage"
              onClick={(e) => {
                e.preventDefault();
                if (confirmNavigation()) router.push('/mypage');
              }}
              className="flex items-center px-3 py-[7px] rounded-md text-base text-secondary
                         hover:bg-page hover:text-primary transition-colors"
            >
              マイページを開く
            </a>
          </div>
        </nav>

        {/* ユーザー情報 */}
        <div className="px-5 pt-4 border-t border-border/20 text-sm text-secondary">
          <div className="text-primary font-medium text-base">
            {user?.name || '管理者'}
          </div>
          <div>{(user as any)?.department || ''}</div>
          <button
            onClick={logout}
            className="mt-2 text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
}
