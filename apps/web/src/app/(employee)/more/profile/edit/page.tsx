/**
 * 個人情報変更ハブページ
 *
 * 変更する項目を選択して各編集ページへ遷移する。
 * HTML プロトタイプ page-profile-edit に準拠。
 */

'use client';

import { useRouter } from 'next/navigation';

const menuItems = [
  {
    label: '住所変更',
    description: '引越し等による住所の変更届',
    href: '/more/profile/edit-address',
  },
  {
    label: '口座変更',
    description: '給与振込先の変更届',
    href: '/more/profile/edit-bank',
  },
  {
    label: '扶養変更',
    description: '扶養親族の追加・削除',
    href: '/more/profile/edit-dependents',
  },
  {
    label: '緊急連絡先変更',
    description: '緊急時の連絡先の変更届',
    href: '/more/profile/edit-emergency',
  },
];

export default function ProfileEditHubPage() {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-sm font-semibold text-secondary">変更する項目を選択</span>
        </div>
        <div className="card p-0">
          {menuItems.map((item, idx) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors text-left
                ${idx < menuItems.length - 1 ? 'border-b border-border-light' : ''}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-md font-medium text-primary">{item.label}</span>
                <span className="text-xs text-secondary">{item.description}</span>
              </div>
              <span className="text-lg text-secondary ml-3 flex-shrink-0">&rsaquo;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
