/**
 * 社員側 申請メニュー + 申請履歴
 *
 * UIモックのpage-applicationsを再現。
 * 申請メニュー（有給休暇申請・交通費申請・各種届出）+ 申請履歴リスト。
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */
interface ApplicationHistoryItem {
  id: string;
  type: string;
  date: string;
  status: 'approved' | 'pending' | 'rejected';
}

/* ---------- ステータス表示設定 ---------- */
const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  approved: { label: '承認済', badgeClass: 'badge-ok' },
  pending:  { label: '確認中', badgeClass: 'badge-warn' },
  rejected: { label: '却下',   badgeClass: 'badge-danger' },
};

/* ---------- 申請メニュー ---------- */
const menuItems = [
  {
    label: '有給休暇申請',
    desc: '残日数: 8日',
    href: '/mypage/leave',
  },
  {
    label: '交通費申請',
    desc: '今月未申請',
    href: '/mypage/expense',
  },
  {
    label: '各種届出',
    desc: '住所変更・口座変更など',
    href: '/more/documents',
  },
];

/* ---------- プレースホルダー申請履歴データ ---------- */
const applicationHistory: ApplicationHistoryItem[] = [
  {
    id: '1',
    type: '有給休暇',
    date: '2026年4月14日〜2026年4月15日',
    status: 'approved',
  },
  {
    id: '2',
    type: '交通費精算',
    date: '2026年2月分 — 18,420円',
    status: 'approved',
  },
  {
    id: '3',
    type: '住所変更届',
    date: '2026年1月20日申請',
    status: 'pending',
  },
];

/* ---------- フィルター選択肢 ---------- */
const filterOptions = [
  { value: 'all', label: 'すべて' },
  { value: 'approved', label: '承認済' },
  { value: 'pending', label: '確認中' },
  { value: 'rejected', label: '却下' },
];

export default function ApplicationsPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? applicationHistory
    : applicationHistory.filter((item) => item.status === filter);

  return (
    <>
      <ToastUI />
      <div className="space-y-6">
        {/* ── 申請メニュー ── */}
        <div>
          <h2 className="text-md font-bold text-primary mb-3">申請メニュー</h2>
          <div className="card p-0">
            {menuItems.map((item, idx) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3.5 hover:bg-page transition-colors
                  ${idx < menuItems.length - 1 ? 'border-b border-border-light' : ''}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-primary">{item.label}</span>
                  <span className="text-xs text-secondary">{item.desc}</span>
                </div>
                <span className="text-base text-secondary flex-shrink-0">›</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── 申請履歴 ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-md font-bold text-primary">申請履歴</h2>

            {/* フィルター */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-white text-primary focus:outline-none"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-10 text-center text-secondary">
              該当する申請履歴はありません
            </div>
          ) : (
            <div className="card p-0">
              {filtered.map((item, idx) => {
                const st = statusConfig[item.status];
                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/applications/${item.id}`)}
                    className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-page transition-colors
                      ${idx < filtered.length - 1 ? 'border-b border-border-light' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-primary">{item.type}</span>
                      <span className="text-xs text-secondary">{item.date}</span>
                    </div>
                    <span className={`badge ${st.badgeClass}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
