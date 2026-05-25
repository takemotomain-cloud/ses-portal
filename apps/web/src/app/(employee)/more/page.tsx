/**
 * その他メニュー
 *
 * UIモックのpage-moreを再現。
 * 全機能へのメニューリスト。
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface MenuItem {
  label: string;
  href: string;
  desc?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

function buildMenuSections(hasBonus: boolean): MenuSection[] {
  const salaryItems: MenuItem[] = [
    { label: '給与明細', href: '/mypage/salary', desc: '月次の給与明細を確認' },
    { label: '稼働情報', href: '/more/assignment', desc: '現在の稼働先・単価・還元率' },
    { label: '源泉徴収票', href: '/more/withholding', desc: '年度別の源泉徴収票' },
  ];
  if (hasBonus) {
    salaryItems.push({ label: '賞与明細', href: '/mypage/bonus', desc: '賞与の支給・控除明細' });
  }
  salaryItems.push({ label: '就業規則', href: '/more/rules', desc: '就業規則の閲覧' });

  return [
    { title: '給与・稼働', items: salaryItems },
    {
      title: '届出',
      items: [
        { label: '休職届', href: '/more/leave-of-absence', desc: '休職届の提出' },
      ],
    },
    {
      title: '年次手続き',
      items: [
        { label: '年末調整', href: '/more/yearend', desc: '年末調整の入力・提出' },
      ],
    },
    {
      title: 'アカウント',
      items: [
        { label: '個人情報', href: '/more/profile', desc: '基本情報・連絡先・口座の確認・変更' },
        { label: 'パスワード変更', href: '/more/password' },
      ],
    },
  ];
}

export default function MorePage() {
  const { user, logout } = useAuth();
  const hasBonus = (user as any)?.hasBonus ?? false;
  const menuSections = useMemo(() => buildMenuSections(hasBonus), [hasBonus]);

  return (
    <div className="space-y-5">
      {menuSections.map((section) => (
        <div key={section.title}>
          <h2 className="text-sm font-semibold text-secondary mb-2 px-1">{section.title}</h2>
          <div className="card p-0">
            {section.items.map((item, idx) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors
                  ${idx < section.items.length - 1 ? 'border-b border-border-light' : ''}`}
              >
                <div>
                  <div className="text-md text-primary">{item.label}</div>
                  {item.desc && <div className="text-sm text-secondary mt-0.5">{item.desc}</div>}
                </div>
                <span className="text-lg text-secondary">›</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* 管理ページへのリンク（admin/manager/member のみ） */}
      {user && ['admin', 'manager', 'member'].includes(user.role) && (
        <div className="card p-0">
          <Link
            href="/admin"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors"
          >
            <div>
              <div className="text-md text-primary">管理ページを開く</div>
              <div className="text-sm text-secondary mt-0.5">管理者ダッシュボードへ移動</div>
            </div>
            <span className="text-lg text-secondary">›</span>
          </Link>
        </div>
      )}

      {/* ログアウト */}
      <div className="card p-0">
        <button
          onClick={logout}
          className="w-full px-4 py-3.5 text-md text-status-red-text text-left hover:bg-page transition-colors"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
