/**
 * 届出・証明書ページ
 *
 * UIモックのpage-documentsを再現。
 * 証明書の新規申請 + 発行履歴（PDF閲覧）。
 *
 * Phase 1: 静的デモ。API連携後にPOST /api/certificates を呼ぶ。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ── 新規申請できる証明書 ── */
const certificateTypes = [
  { id: 'zaiseki', name: '在籍証明書', note: '発行まで3〜5営業日' },
  { id: 'shuunyuu', name: '収入証明書', note: '発行まで3〜5営業日' },
];

/* ── 発行履歴の型 ── */
interface CertificateRecord {
  id: string;
  certType: string;
  status: string;
  issuedAt?: string;
  createdAt: string;
}

/* ── 発行履歴（API接続後に動的取得） ── */
const fallbackHistory: {
  id: string;
  type: string;
  date: string;
  status: 'issued' | 'pending';
}[] = [];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function DocumentsPage() {
  const { toast, ToastUI } = useToast();
  const [previewCert, setPreviewCert] = useState<{ type: string; date: string } | null>(null);
  const [history, setHistory] = useState(fallbackHistory);
  const [requesting, setRequesting] = useState<string | null>(null);

  /** 証明書履歴をAPIから取得 */
  const loadHistory = useCallback(async () => {
    try {
      const data = await apiClient<CertificateRecord[]>('/certificates');
      if (data && data.length > 0) {
        setHistory(
          data.map((c) => ({
            id: c.id,
            type: c.certType,
            date: c.status === 'issued'
              ? `${formatDate(c.issuedAt || c.createdAt)}発行`
              : `${formatDate(c.createdAt)}申請`,
            status: c.status === 'issued' ? 'issued' as const : 'pending' as const,
          })),
        );
      }
    } catch {
      // API未接続の場合はフォールバックデータを使用
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /** 証明書発行リクエスト */
  async function handleRequest(name: string) {
    setRequesting(name);
    try {
      await apiClient('/certificates/request', {
        method: 'POST',
        body: JSON.stringify({ certType: name }),
      });
      toast('証明書の発行を申請しました');
      await loadHistory();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '申請に失敗しました';
      toast(message);
    } finally {
      setRequesting(null);
    }
  }

  /** PDF プレビュー画面を開く */
  function handlePreview(type: string, date: string) {
    setPreviewCert({ type, date });
  }

  /* ── PDF プレビュー画面 ── */
  if (previewCert) {
    return (
      <div className="space-y-5">
        {/* ヘッダー戻るボタン */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => setPreviewCert(null)}
            className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page"
          >
            ‹
          </button>
          <h1 className="text-lg font-bold text-primary">証明書</h1>
        </div>

        {/* PDF アイコン + アクションボタン */}
        <div className="card p-8 text-center">
          <div className="mb-4 flex justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="text-md font-bold mb-1">{previewCert.type}</div>
          <div className="text-sm text-secondary mb-6">{previewCert.date}</div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => toast('PDF機能は今後追加予定です')}
              className="px-6 py-2.5 rounded-lg bg-accent text-accent-text text-sm font-medium hover:opacity-90 transition-opacity"
            >
              閲覧する
            </button>
            <button
              onClick={() => toast('PDF機能は今後追加予定です')}
              className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-primary hover:bg-page transition-colors"
            >
              ダウンロード
            </button>
          </div>
        </div>

        {/* 発行情報 */}
        <div className="card p-0">
          <div className="px-4 py-3 border-b border-border-light">
            <div className="text-sm font-bold text-primary">発行情報</div>
          </div>
          <div className="px-4 py-3 flex justify-between items-center border-b border-border-light">
            <span className="text-sm text-secondary">証明書種別</span>
            <span className="text-sm text-primary">{previewCert.type}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center border-b border-border-light">
            <span className="text-sm text-secondary">発行日</span>
            <span className="text-sm text-primary">{previewCert.date.replace('発行', '')}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-secondary">ファイル形式</span>
            <span className="text-sm text-primary">PDF</span>
          </div>
        </div>

        <ToastUI />
      </div>
    );
  }

  /* ── メインページ ── */
  return (
    <div className="space-y-5">
      {/* 新規申請 */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">新規申請</h2>
        <div className="card p-0">
          {certificateTypes.map((cert, idx) => (
            <div
              key={cert.id}
              onClick={() => !requesting && handleRequest(cert.name)}
              className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-page transition-colors
                ${idx < certificateTypes.length - 1 ? 'border-b border-border-light' : ''}
                ${requesting ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div>
                <p className="text-md text-primary font-medium">{cert.name}</p>
                <p className="text-sm text-secondary mt-0.5">
                  {requesting === cert.name ? '申請中...' : cert.note}
                </p>
              </div>
              <span className="text-secondary text-lg">›</span>
            </div>
          ))}
        </div>
      </div>

      {/* 発行履歴 */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">発行履歴</h2>
        {history.length === 0 ? (
          <div className="card p-10 text-center text-secondary">発行履歴はありません</div>
        ) : (
        <div className="card p-0">
          {history.map((item, idx) => (
            <div
              key={item.id}
              onClick={() =>
                item.status === 'issued'
                  ? handlePreview(item.type, item.date)
                  : undefined
              }
              className={`flex items-center justify-between px-4 py-3.5 transition-colors
                ${item.status === 'issued' ? 'cursor-pointer hover:bg-page' : ''}
                ${idx < history.length - 1 ? 'border-b border-border-light' : ''}`}
            >
              <div>
                <p className="text-md text-primary font-medium">{item.type}</p>
                <p className="text-sm text-secondary mt-0.5">{item.date}</p>
              </div>
              {item.status === 'issued' ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge badge-info">PDF</span>
                  <span className="text-lg text-secondary">›</span>
                </div>
              ) : (
                <span className="badge badge-warn">発行待ち</span>
              )}
            </div>
          ))}
        </div>
        )}
        <p className="text-2xs text-secondary mt-2 px-1">
          発行済の証明書はタップでPDFを閲覧・ダウンロードできます
        </p>
      </div>

      <ToastUI />
    </div>
  );
}
