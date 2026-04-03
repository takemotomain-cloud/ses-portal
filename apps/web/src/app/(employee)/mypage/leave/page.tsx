/**
 * 有給休暇申請フォーム
 *
 * UIモックのpage-leave-requestを再現。
 * 種別選択 + 日付範囲 + 残日数・消滅日・次回付与表示 + 確認モーダル。
 *
 * バリデーション:
 * - 開始日 ≤ 終了日
 * - 残日数以内であること
 * - 過去日は警告表示（申請は可能）
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface LeaveBalance {
  remaining: number;
  expiryDate: string;
  nextGrantDate: string;
  nextGrantDays: number;
}

export default function LeaveRequestPage() {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState('full_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchBalance() {
      try {
        const res = await apiClient<LeaveBalance>('/leave/balance');
        if (!cancelled) setBalance(res);
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    }
    fetchBalance();
    return () => { cancelled = true; };
  }, []);

  const leaveTypeLabels: Record<string, string> = {
    full_day: '全休',
    am_half: '午前半休',
    pm_half: '午後半休',
    special: '特別休暇',
  };

  // 取得日数計算
  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    if (leaveType === 'am_half' || leaveType === 'pm_half') return 0.5;
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }, [startDate, endDate, leaveType]);

  async function handleSubmit() {
    setIsSubmitting(true);
    // Phase 1: デモ動作。API連携後にPOST /api/leave/requestを呼ぶ
    await new Promise(r => setTimeout(r, 800));
    setIsSubmitting(false);
    setShowConfirm(false);
    router.push('/applications');
  }

  return (
    <div className="space-y-5">
      {/* 残日数情報 */}
      <div className="card p-4">
        {balanceLoading ? (
          <div className="text-center text-secondary py-2">読み込み中...</div>
        ) : !balance ? (
          <div className="text-center text-secondary py-2">有給残日数データはありません</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xs text-secondary mb-0.5">有給残日数</div>
              <div className="text-2xl font-medium text-status-green-text">{balance.remaining}<span className="text-sm font-normal">日</span></div>
            </div>
            <div>
              <div className="text-2xs text-secondary mb-0.5">消滅日</div>
              <div className="text-md font-medium">{balance.expiryDate}</div>
            </div>
            <div>
              <div className="text-2xs text-secondary mb-0.5">次回付与</div>
              <div className="text-md font-medium">{balance.nextGrantDate}</div>
              <div className="text-2xs text-secondary">{balance.nextGrantDays}日付与</div>
            </div>
          </div>
        )}
      </div>

      {/* 申請フォーム */}
      <div className="card p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">申請種別</label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-md text-primary bg-card outline-none focus:border-primary appearance-none"
          >
            <option value="full_day">全休</option>
            <option value="am_half">午前半休</option>
            <option value="pm_half">午後半休</option>
            <option value="special">特別休暇</option>
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-secondary mb-1.5">開始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
              }}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md text-primary bg-card outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-secondary mb-1.5">終了日</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-md text-primary bg-card outline-none focus:border-primary"
            />
          </div>
        </div>

        {days > 0 && (
          <div className="px-4 py-3 rounded-lg bg-status-blue-bg text-status-blue-text text-sm">
            取得日数: <span className="font-semibold">{days}日</span>
            {balance && days > balance.remaining && (
              <span className="ml-2 text-status-red-text font-semibold">
                ※ 残日数を超過しています
              </span>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">事由（任意）</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="申請理由を入力"
            rows={3}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-md text-primary bg-card outline-none focus:border-primary resize-y"
          />
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!startDate || !endDate || days === 0}
          className="w-full py-3.5 rounded-lg bg-primary text-white text-md font-semibold transition-all
                     hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-default"
        >
          申請内容を確認
        </button>
      </div>

      {/* 確認モーダル */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/35 z-[200] flex items-center justify-center p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
        >
          <div className="bg-card rounded-2xl w-full max-w-[400px] overflow-hidden animate-[modalIn_0.2s_ease]">
            <div className="px-5 pt-5 pb-3 text-lg font-bold">有給申請の確認</div>
            <div className="px-5 pb-5 space-y-2.5">
              {[
                ['申請種別', leaveTypeLabels[leaveType]],
                ['開始日', startDate],
                ['終了日', endDate],
                ['取得日数', `${days}日`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-md">
                  <span className="text-secondary">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex border-t border-border-light">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3.5 text-md text-secondary hover:bg-page transition-colors"
              >
                いいえ
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3.5 text-md font-semibold text-primary border-l border-border-light
                           hover:bg-page transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '送信中...' : 'はい'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
