/**
 * 休職届ページ
 *
 * UIモックのpage-leave-of-absenceを再現。
 * 休職種別 + 開始日/復職予定日 + 理由・備考 + 診断書案内。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

export default function LeaveOfAbsencePage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!type || !startDate || !returnDate) {
      toast('休職種別・開始日・復職予定日を入力してください');
      return;
    }
    setLoading(true);
    try {
      await apiClient('/leave/request', {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate: returnDate,
          leaveType: type,
          reason,
          days: 1,
        }),
      });
      toast('休職届を提出しました');
      setTimeout(() => router.back(), 1000);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '送信に失敗しました';
      toast(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ToastUI />
      <div className="space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
          <h1 className="text-lg font-bold text-primary">休職届</h1>
        </div>

        <div className="card p-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">休職種別</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary appearance-none">
                <option value="">選択してください</option>
                <option value="injury">傷病休職</option>
                <option value="childcare">育児休業</option>
                <option value="nursing">介護休業</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-primary mb-1.5">休職開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-primary mb-1.5">復職予定日</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">理由・備考</label>
              <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary resize-none" placeholder="休職の理由を入力してください" />
            </div>
            <p className="text-xs text-secondary mt-2">
              傷病休職の場合、医師の診断書の添付が必要です。提出後に管理者から連絡いたします。
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 transition-all disabled:opacity-50"
        >
          {loading ? '送信中...' : '提出する'}
        </button>
      </div>
    </>
  );
}
