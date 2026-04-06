/**
 * 遅延証明書の提出ページ
 *
 * 社員が遅延証明書（画像/PDF）を添付して提出する。
 * 提出履歴も表示。
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface DelayCert {
  id: string;
  targetDate: string;
  route: string | null;
  reason: string | null;
  fileName: string | null;
  filePath: string | null;
  status: string;
  createdAt: string;
}

const statusLabel: Record<string, { text: string; cls: string }> = {
  submitted: { text: '提出済', cls: 'bg-status-amber-bg text-status-amber-text' },
  confirmed: { text: '確認済', cls: 'bg-status-green-bg text-status-green-text' },
};

export default function DelayCertificatePage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [route, setRoute] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 履歴
  const [history, setHistory] = useState<DelayCert[]>([]);

  const loadHistory = useCallback(() => {
    apiClient<DelayCert[]>('/delay-certificates/my')
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = useCallback(async () => {
    if (!targetDate) {
      toast('対象日付を選択してください');
      return;
    }
    if (!file) {
      toast('遅延証明書のファイルを添付してください');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('targetDate', targetDate);
      if (route) formData.append('route', route);
      if (reason) formData.append('reason', reason);
      formData.append('file', file);

      const token = getToken();
      const res = await fetch('/api/delay-certificates/submit', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '提出に失敗しました' }));
        throw new Error(err.message);
      }

      toast('遅延証明書を提出しました');
      setTargetDate(new Date().toISOString().split('T')[0]);
      setRoute('');
      setReason('');
      setFile(null);
      loadHistory();
    } catch (err: any) {
      toast(err.message || 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }, [targetDate, route, reason, file, toast, loadHistory]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
  };

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/applications')}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page"
        >
          ‹
        </button>
        <h1 className="text-lg font-bold text-primary">遅延証明書の提出</h1>
      </div>

      {/* 提出フォーム */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-sm text-secondary mb-1">
            対象日付 <span className="text-status-red-text">*</span>
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1">利用路線</label>
          <input
            type="text"
            value={route}
            onChange={e => setRoute(e.target.value)}
            placeholder="例: JR中央線"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1">遅延理由・備考</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="例: 人身事故により約30分遅延"
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary resize-none"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1">
            証明書ファイル <span className="text-status-red-text">*</span>
          </label>
          <div
            onClick={() => !submitting && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
              ${file ? 'border-status-green-text bg-status-green-bg' : 'border-border hover:border-primary/50'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
            />
            {file ? (
              <div>
                <p className="text-base font-medium text-primary">{file.name}</p>
                <p className="text-sm text-secondary mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                {!submitting && (
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="text-sm text-status-red-text mt-2 hover:underline"
                  >
                    削除
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-base text-secondary">タップして写真・PDFを選択</p>
                <p className="text-2xs text-secondary/70 mt-1">画像またはPDF（10MBまで）</p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!targetDate || !file || submitting}
          className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              提出中...
            </>
          ) : (
            '提出する'
          )}
        </button>
      </div>

      {/* 提出履歴 */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">提出履歴</h2>
        <div className="card p-0">
          {history.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">提出履歴はありません</div>
          ) : (
            <ul>
              {history.map((item, idx) => {
                const st = statusLabel[item.status] || { text: item.status, cls: 'bg-border-light text-secondary' };
                return (
                  <li
                    key={item.id}
                    className={`px-4 py-3 ${idx < history.length - 1 ? 'border-b border-border-light' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-md font-medium">{formatDate(item.targetDate)}</span>
                      <span className={`text-2xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                    </div>
                    <div className="text-sm text-secondary">
                      {item.route && <span>{item.route}</span>}
                      {item.route && item.reason && <span> — </span>}
                      {item.reason && <span>{item.reason}</span>}
                    </div>
                    {item.fileName && item.filePath && (
                      <a
                        href={item.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs text-primary hover:underline mt-0.5 inline-block"
                      >
                        📎 {item.fileName}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
