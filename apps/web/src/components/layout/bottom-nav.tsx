/**
 * ボトムナビゲーション
 *
 * 社員マイページの4タブナビゲーション。
 * UIモック準拠: ホーム / 勤怠 / 申請 / その他。
 * フィル型アイコンで統一。アクティブタブに上部インジケーター。
 *
 * レスポンシブ: PC幅（768px以上）では中央に固定（max-width: 480px）。
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
  /** ルートがこのprefixで始まる場合にアクティブ */
  matchPrefix: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'ホーム',
    href: '/mypage',
    matchPrefix: '/mypage',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
      </svg>
    ),
  },
  {
    label: '勤怠表',
    href: '/attendance',
    matchPrefix: '/attendance',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    label: '申請',
    href: '/applications',
    matchPrefix: '/applications',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path
          fillRule="evenodd"
          d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25H6.25a.75.75 0 0 1 0-1.5h2.25V9.5a.75.75 0 0 1 .75-.75Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    label: 'その他',
    href: '/more',
    matchPrefix: '/more',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path
          fillRule="evenodd"
          d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  /**
   * アクティブ判定
   * /mypage は完全一致（/mypage/salary等と区別）
   * 他はプレフィックス一致
   */
  function isActive(item: NavItem): boolean {
    if (item.href === '/mypage') {
      return pathname === '/mypage';
    }
    return pathname.startsWith(item.matchPrefix);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-bottom-nav bg-card border-t border-border
                 flex items-stretch z-50
                 md:left-1/2 md:-translate-x-1/2 md:max-w-[480px] md:rounded-t-2xl md:border-x"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {navItems.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5
                       text-2xs relative transition-colors
                       ${active ? 'text-primary' : 'text-secondary'}`}
          >
            {/* アクティブインジケーター */}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-b" />
            )}
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
