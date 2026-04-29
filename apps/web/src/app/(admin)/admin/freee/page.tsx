/**
 * 管理側 freee連携
 *
 * 接続状態 + 未送信仕訳 + 送信履歴 + エラーログ。
 * freeeに送るのは仕訳だけ。請求書はSES特有明細のため自社生成。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ------------------------------------------------------------------ */
/*  型定義                                                              */
/* ------------------------------------------------------------------ */

interface FreeeJournal {
  id: string;
  date: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  status: string; // unsent | sent | error
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface FreeeSummary {
  total: number;
  sent: number;
  errors: number;
  unsent: number;
}

/* ------------------------------------------------------------------ */
/*  ヘルパー                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

function fmtDateTime(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日 ${dt.getHours()}時${String(dt.getMinutes()).padStart(2, '0')}分`;
}

/* ================================================================== */
/*  コンポーネント                                                      */
/* ================================================================== */

export default function AdminFreeePage() {
  const { toast, ToastUI } = useToast();
  const [journals, setJournals] = useState<FreeeJournal[]>([]);
  const [summary, setSummary] = useState<FreeeSummary>({ total: 0, sent: 0, errors: 0, unsent: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [journalData, summaryData] = await Promise.all([
        apiClient<FreeeJournal[]>('/freee/journals'),
        apiClient<FreeeSummary>('/freee/summary'),
      ]);
      setJournals(journalData);
      setSummary(summaryData);
    } catch {
      toast('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unsent = journals.filter(j => j.status === 'unsent');
  const sent = journals.filter(j => j.status === 'sent' || j.status === 'error').sort((a, b) => {
    const da = a.sentAt || a.createdAt;
    const db = b.sentAt || b.createdAt;
    return new Date(db).getTime() - new Date(da).getTime();
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await apiClient<{ success: number; errors: number; total: number }>('/freee/sync', { method: 'POST' });
      toast(`同期完了: 成功 ${result.success}件、エラー ${result.errors}件`);
      fetchData();
    } catch {
      toast('同期に失敗しました');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSendOne(id: string) {
    try {
      await apiClient(`/freee/journals/${id}/send`, { method: 'PATCH' });
      toast('送信しました');
      fetchData();
    } catch {
      toast('送信に失敗しました');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <ToastUI />

      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">freee連携</h1>
        <div className="flex gap-2">
          <button onClick={() => toast('トークン更新機能は今後実装予定です')} className="btn-outline text-sm py-2">トークン更新</button>
          <button onClick={handleSync} disabled={syncing} className="btn-primary text-sm py-2">
            {syncing ? '同期中…' : '手動同期'}
          </button>
        </div>
      </div>

      {/* 接続状態 */}
      <div className="card p-5 flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="text-lg font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-green-text" />
            freee会計と接続中
          </div>
          <div className="text-sm text-secondary">事業所: 株式会社サンプルSES</div>
        </div>
        <button onClick={() => toast('接続設定機能は今後実装予定です')} className="btn-outline text-sm py-2">接続設定</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">今月の送信仕訳</div>
          <div className="text-3xl font-medium">{summary.total}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">成功</div>
          <div className="text-3xl font-medium text-status-green-text">{summary.sent}<span className="text-base font-normal ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">エラー</div>
          <div className="text-3xl font-medium text-status-red-text">{summary.errors}<span className="text-base font-normal ml-1">件</span></div>
        </div>
      </div>

      {/* 未送信の仕訳 */}
      <div className="mb-4">
        <h2 className="text-md font-medium mb-3">未送信の仕訳</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[550px]">
            <thead>
              <tr className="border-b border-border">
                {['日付', '摘要', '借方', '貸方', '金額', ''].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unsent.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-secondary">未送信の仕訳はありません</td></tr>
              ) : unsent.map(j => (
                <tr key={j.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base">{fmtDate(j.date)}</td>
                  <td className="px-4 py-2.5 text-base">{j.description}</td>
                  <td className="px-4 py-2.5 text-base">{j.debitAccount}</td>
                  <td className="px-4 py-2.5 text-base">{j.creditAccount}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(j.amount)}円</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleSendOne(j.id)} className="btn-outline text-xs py-1 px-3">送信</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 送信履歴 */}
      <div>
        <h2 className="text-md font-medium mb-3">送信履歴</h2>
        <div className="card p-0">
          {sent.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-secondary">送信履歴はありません</div>
          ) : sent.map(j => (
            <div key={j.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/20 last:border-b-0">
              <span className="text-sm text-secondary min-w-[160px]">{j.sentAt ? fmtDateTime(j.sentAt) : fmtDate(j.date)}</span>
              <span className={`text-base flex-1 ${j.status === 'error' ? 'text-secondary' : ''}`}>
                {j.status === 'error' ? (j.errorMessage || 'エラー') : `${j.description} を送信`}
              </span>
              <span className={`badge ${j.status === 'sent' ? 'badge-ok' : 'badge-danger'}`}>
                {j.status === 'sent' ? '成功' : 'エラー'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
