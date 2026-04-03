/**
 * 休職申請ページ
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaveOfAbsencePage() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!reason || !startDate) return;
    setSubmitted(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
        <h1 className="text-lg font-bold text-primary">休職申請</h1>
      </div>

      {submitted ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-4">✓</p>
          <p className="text-lg font-bold text-primary mb-2">申請を受け付けました</p>
          <p className="text-sm text-secondary mb-6">人事部で確認後、メールにてご連絡します。</p>
          <button onClick={() => router.push('/mypage')} className="px-6 py-2.5 rounded-lg bg-primary text-white text-md font-medium hover:opacity-90">ホームに戻る</button>
        </div>
      ) : (
        <>
          <div className="card p-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">休職開始日 <span className="text-status-red-text">*</span></label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">休職終了予定日</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary" />
                <p className="text-xs text-secondary mt-1">未定の場合は空欄可</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">理由 <span className="text-status-red-text">*</span></label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary appearance-none">
                  <option value="">選択してください</option>
                  <option value="health">傷病休職</option>
                  <option value="family">育児休職</option>
                  <option value="care">介護休職</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">備考</label>
                <textarea rows={3} className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary resize-none" placeholder="補足事項があれば記入してください" />
              </div>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!reason || !startDate}
            className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 disabled:opacity-35 transition-all"
          >
            申請する
          </button>
        </>
      )}
    </div>
  );
}
