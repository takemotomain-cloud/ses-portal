/**
 * 休職届ページ
 *
 * - 休職届フォーム（種別、期間、理由、診断書アップロード）
 * - 自分の休職届一覧
 * - 休職中の場合: 復職届提出
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient, getToken } from '@/lib/api-client';

interface LoaRecord {
  id: string;
  absenceType: string;
  startDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
  reason: string | null;
  fileName: string | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
}

const absenceTypeLabel: Record<string, string> = {
  injury: '傷病休職',
  childcare: '育児休業',
  nursing: '介護休業',
  other: 'その他',
};

const statusLabel: Record<string, string> = {
  pending: '承認待ち',
  on_leave: '休職中',
  return_pending: '復職承認待ち',
  returned: '復職済',
  rejected: '却下',
};

const statusColor: Record<string, string> = {
  pending: 'bg-status-yellow-bg text-status-yellow-text',
  on_leave: 'bg-status-blue-bg text-status-blue-text',
  return_pending: 'bg-status-yellow-bg text-status-yellow-text',
  returned: 'bg-status-green-bg text-status-green-text',
  rejected: 'bg-status-red-bg text-status-red-text',
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function LeaveOfAbsencePage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  // フォーム
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 一覧
  const [records, setRecords] = useState<LoaRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // 復職届モーダル
  const [returnModal, setReturnModal] = useState<LoaRecord | null>(null);
  const [actualReturnDate, setActualReturnDate] = useState('');
  const [returningId, setReturningId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await apiClient<LoaRecord[]>('/leave-of-absence/my');
      setRecords(data);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 未完了の休職届があるかどうか
  const hasActive = records.some(r => ['pending', 'on_leave', 'return_pending'].includes(r.status));
  // 休職中の記録（復職届ボタン表示用）
  const onLeaveRecord = records.find(r => r.status === 'on_leave');

  async function handleSubmit() {
    if (!type || !startDate || !returnDate) {
      toast('休職種別・開始日・復職予定日を入力してください');
      return;
    }
    if (new Date(returnDate) <= new Date(startDate)) {
      toast('復職予定日は開始日より後にしてください');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('absenceType', type);
      formData.append('startDate', startDate);
      formData.append('expectedReturnDate', returnDate);
      if (reason) formData.append('reason', reason);
      if (file) formData.append('file', file);

      const token = getToken();
      const res = await fetch('/api/leave-of-absence/submit', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '提出に失敗しました' }));
        throw new Error(err.message);
      }

      toast('休職届を提出しました');
      setType('');
      setStartDate('');
      setReturnDate('');
      setReason('');
      setFile(null);
      fetchRecords();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '送信に失敗しました';
      toast(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReturn() {
    if (!returnModal || !actualReturnDate) {
      toast('復職日を入力してください');
      return;
    }

    setReturningId(returnModal.id);
    try {
      await apiClient(`/leave-of-absence/${returnModal.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ actualReturnDate }),
      });
      toast('復職届を提出しました');
      setReturnModal(null);
      setActualReturnDate('');
      fetchRecords();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '送信に失敗しました';
      toast(message);
    } finally {
      setReturningId(null);
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

        {/* 復職届ボタン（休職中の場合） */}
        {onLeaveRecord && (
          <div className="card p-4 border-l-4 border-blue-400">
            <div className="text-sm font-medium text-primary mb-1">現在休職中です</div>
            <div className="text-xs text-secondary mb-3">
              {absenceTypeLabel[onLeaveRecord.absenceType] || onLeaveRecord.absenceType}
              ・{fmtDate(onLeaveRecord.startDate)}〜{fmtDate(onLeaveRecord.expectedReturnDate)}
            </div>
            <button
              onClick={() => { setReturnModal(onLeaveRecord); setActualReturnDate(''); }}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-all"
            >
              復職届を提出する
            </button>
          </div>
        )}

        {/* 休職届フォーム（未完了の届がない場合のみ表示） */}
        {!hasActive && (
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
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">診断書・添付ファイル</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:bg-white file:text-primary hover:file:bg-page"
                />
                {file && <p className="text-xs text-secondary mt-1">{file.name}</p>}
              </div>
              <p className="text-xs text-secondary mt-2">
                傷病休職の場合、医師の診断書の添付が必要です。提出後に管理者から連絡いたします。
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4 py-3 rounded-lg bg-primary text-white text-md font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {submitting ? '送信中...' : '提出する'}
            </button>
          </div>
        )}

        {/* 自分の休職届一覧 */}
        <div>
          <h2 className="text-md font-medium text-primary mb-2">休職届の履歴</h2>
          <div className="card p-0">
            {loadingList ? (
              <div className="px-5 py-4 text-sm text-secondary">読み込み中...</div>
            ) : records.length === 0 ? (
              <div className="px-5 py-4 text-sm text-secondary">休職届の履歴はありません</div>
            ) : (
              records.map((r, idx) => (
                <div key={r.id} className={`px-5 py-3.5 ${idx < records.length - 1 ? 'border-b border-border/20' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">
                      {absenceTypeLabel[r.absenceType] || r.absenceType}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[r.status] || r.status}
                    </span>
                  </div>
                  <div className="text-xs text-secondary">
                    {fmtDate(r.startDate)}〜{fmtDate(r.expectedReturnDate)}
                  </div>
                  {r.actualReturnDate && (
                    <div className="text-xs text-secondary">復職日: {fmtDate(r.actualReturnDate)}</div>
                  )}
                  {r.reason && <div className="text-xs text-secondary mt-0.5">{r.reason}</div>}
                  {r.rejectReason && (
                    <div className="text-xs text-red-500 mt-0.5">却下理由: {r.rejectReason}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 復職届モーダル */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReturnModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-primary">復職届</h3>
            <div className="text-sm text-secondary">
              {absenceTypeLabel[returnModal.absenceType] || returnModal.absenceType}
              ・{fmtDate(returnModal.startDate)}〜
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">復職日</label>
              <input
                type="date"
                value={actualReturnDate}
                onChange={(e) => setActualReturnDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-md bg-white outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setReturnModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:bg-page transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleReturn}
                disabled={returningId === returnModal.id || !actualReturnDate}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {returningId === returnModal.id ? '送信中...' : '提出する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
