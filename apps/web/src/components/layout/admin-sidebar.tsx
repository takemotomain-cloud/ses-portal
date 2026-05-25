/**
 * 管理画面 サイドバー
 *
 * UIモック準拠のサイドナビゲーション。
 * セクション: アラート / 営業 / 人事・労務 / 採用 / 経理・管理 / 設定
 * 1024px以下でハンバーガーメニューに切替。
 *
 * E: ロールベース表示
 * - admin:    全セクション表示（給与管理含む）
 * - manager:  全セクション表示（給与管理含む、ただし admin/他 manager の行はマスク）
 * - member:   給与管理メニューは非表示（アクセスしても /mypage/payroll へリダイレクト）
 * - employee: レイアウト自体が /mypage へリダイレクト
 */

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { useNavigationGuard } from '@/lib/navigation-guard';

interface NavItem {
  label: string;
  href: string;
  badge?: number;
  /** 表示対象ロール（未指定 = 全ロール） */
  roles?: string[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarCounts {
  approvalCount: number;
  unreadCount: number;
}

const SIDEBAR_COUNTS_CACHE_KEY = 'ses_portal_admin_sidebar_counts_v1';
const SIDEBAR_COUNTS_CACHE_TTL_MS = 60 * 1000;

function readCachedSidebarCounts(): SidebarCounts | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(SIDEBAR_COUNTS_CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as SidebarCounts & { cachedAt: number };
    if (Date.now() - cached.cachedAt > SIDEBAR_COUNTS_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(SIDEBAR_COUNTS_CACHE_KEY);
      return null;
    }

    return {
      approvalCount: cached.approvalCount || 0,
      unreadCount: cached.unreadCount || 0,
    };
  } catch {
    window.sessionStorage.removeItem(SIDEBAR_COUNTS_CACHE_KEY);
    return null;
  }
}

function writeCachedSidebarCounts(counts: SidebarCounts): void {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(
    SIDEBAR_COUNTS_CACHE_KEY,
    JSON.stringify({ ...counts, cachedAt: Date.now() }),
  );
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
      { label: 'AIエージェント', href: '/admin/dashboard' },
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
      { label: '社内勤怠', href: '/admin/attendance-internal', roles: ['admin', 'manager'] },
      { label: '給与管理', href: '/admin/payroll', roles: ['admin', 'manager'] },
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
    const cachedCounts = readCachedSidebarCounts();
    if (cachedCounts) {
      setApprovalCount(cachedCounts.approvalCount);
      setUnreadCount(cachedCounts.unreadCount);
    }

    async function fetchCounts() {
      try {
        const summary = await apiClient<SidebarCounts>('/approvals/sidebar-summary');
        const counts = {
          approvalCount: summary.approvalCount || 0,
          unreadCount: summary.unreadCount || 0,
        };
        setApprovalCount(counts.approvalCount);
        setUnreadCount(counts.unreadCount);
        writeCachedSidebarCounts(counts);
      } catch {
        if (!cachedCounts) {
          setApprovalCount(0);
          setUnreadCount(0);
        }
      }
    }
    const timeout = window.setTimeout(fetchCounts, cachedCounts ? 1000 : 150);
    // 画面操作中のAPI競合を減らすため、件数の自動更新はやや控えめにする
    const interval = window.setInterval(fetchCounts, 60000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
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
          <Link href="/admin/dashboard" className="flex flex-col">
            <span className="text-xl font-bold text-primary tracking-tight">
              {user?.tenantName || 'SES Portal'}
            </span>
            <span className="text-[10px] text-secondary font-semibold uppercase tracking-[0.2em] mt-0.5">
              Admin Console
            </span>
          </Link>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1">
          {navSections.map((section) => {
            // E: ロールでフィルタ
            const visibleItems = section.items.filter(
              (item) => !item.roles || !user?.role || item.roles.includes(user.role),
            );
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.label} className="px-3 mb-4">
              <div className="text-2xs text-secondary/60 uppercase tracking-widest px-2 mb-1">
                {section.label}
              </div>
              {visibleItems.map((item) => {
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
            );
          })}

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
