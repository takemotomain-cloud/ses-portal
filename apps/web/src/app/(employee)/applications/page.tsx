/**
 * 社員側 申請メニュー + 申請履歴
 *
 * UIモックのpage-applicationsを再現。
 * 申請メニュー（有給休暇申請・交通費申請・各種届出）+ 申請履歴リスト。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- 型定義 ---------- */
interface ApplicationHistoryItem {
  id: string;
  type: string;
  date: string;
  status: 'approved' | 'pending' | 'rejected';
}

/** API レスポンス型 */
interface ExpenseResponse {
  id: string;
  targetMonth: string;
  totalAmount: number;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  items: unknown[];
}

interface LeaveBalanceResponse {
  remaining: number;
}

/* ---------- ステータス表示設定 ---------- */
const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  approved: { label: '承認済', badgeClass: 'badge-ok' },
  pending:  { label: '確認中', badgeClass: 'badge-warn' },
  rejected: { label: '却下',   badgeClass: 'badge-danger' },
};

/* ---------- 日付フォーマット ---------- */
function formatJapaneseDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

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
  const [applicationHistory, setApplicationHistory] = useState<ApplicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveRemaining, setLeaveRemaining] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expenses, leaveBalance] = await Promise.all([
        apiClient<ExpenseResponse[]>('/expense/my').catch(() => [] as ExpenseResponse[]),
        apiClient<LeaveBalanceResponse>('/leave/balance').catch(() => null),
      ]);

      const mapped: ApplicationHistoryItem[] = expenses.map((e) => ({
        id: e.id,
        type: '交通費申請',
        date: formatJapaneseDate(e.createdAt),
        status: e.status,
      }));
      setApplicationHistory(mapped);

      if (leaveBalance) {
        setLeaveRemaining(leaveBalance.remaining);
      }
    } catch {
      setApplicationHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- 申請メニュー ---------- */
  const menuItems = [
    {
      label: '有給休暇申請',
      desc: leaveRemaining !== null ? `残日数: ${leaveRemaining}日` : '残日数: --日',
      href: '/mypage/leave',
    },
    {
      label: '交通費申請',
      desc: '今月未申請',
      href: '/mypage/expense',
    },
    {
      label: '遅延証明書',
      desc: '遅延証明書の提出',
      href: '/applications/delay-certificate',
    },
    {
      label: '各種届出',
      desc: '住所変更・口座変更など',
      href: '/more/documents',
    },
  ];

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

          {loading ? (
            <div className="card p-10 text-center text-secondary">
              読み込み中...
            </div>
          ) : filtered.length === 0 ? (
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
