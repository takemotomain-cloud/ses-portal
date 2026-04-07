/**
 * 管理側 請求管理
 *
 * 月切替 + 請求書一覧 + プレビュータブ。
 * SES特有の明細（技術者名・単価・精算幅・実績時間）を含む請求書を自社生成。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ------------------------------------------------------------------ */
/*  型定義                                                              */
/* ------------------------------------------------------------------ */

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

interface InvoiceItem {
  id: string;
  employeeName: string;
  description: string;
  workHours: number | null;
  unitPrice: number;
  settlementLower: number | null;
  settlementUpper: number | null;
  overtimeAmount: number;
  deductionAmount: number;
  subtotal: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  clientId: string;
  client: { id: string; name: string; address?: string; contactPerson?: string; contactEmail?: string };
  targetMonth: string;
  totalAmount: number;
  tax: number;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  recipientEmail: string | null;
  notes: string | null;
  sentAt: string | null;
  paidAt: string | null;
  items: InvoiceItem[];
}

/* ------------------------------------------------------------------ */
/*  ヘルパー                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

const statusBadge: Record<InvoiceStatus, { label: string; cls: string }> = {
  paid:    { label: '入金済', cls: 'badge-ok' },
  sent:    { label: '送付済', cls: 'badge-info' },
  draft:   { label: '下書き', cls: 'badge-wait' },
  overdue: { label: '遅延',   cls: 'badge-danger' },
};

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

/* ================================================================== */
/*  コンポーネント                                                      */
/* ================================================================== */

export default function AdminBillingPage() {
  const [tab, setTab] = useState<0 | 1>(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const { toast, ToastUI } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // 月ラベル
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthLabel = `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月`;
  const monthQuery = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<Invoice[]>(`/invoices?month=${monthQuery}`);
      setInvoices(data);
    } catch {
      toast('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [monthQuery]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // KPI
  const total      = invoices.reduce((s, i) => s + i.totalAmount + i.tax, 0);
  const paidTotal  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount + i.tax, 0);
  const unpaid     = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.totalAmount + i.tax, 0);
  const overdueAmt = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount + i.tax, 0);

  async function handleStatusUpdate(id: string, status: string) {
    try {
      await apiClient(`/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast('ステータスを更新しました');
      fetchInvoices();
    } catch {
      toast('更新に失敗しました');
    }
  }

  function openPreview(inv: Invoice) {
    setSelectedInvoice(inv);
    setTab(1);
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">請求管理</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-outline text-sm py-2">一括PDF出力</button>
          <button onClick={() => toast('請求書作成機能は今後実装予定です')} className="btn-primary text-sm py-2">請求書作成</button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-0 mb-5 border-b border-border">
        {(['請求一覧', '請求書プレビュー'] as const).map((label, idx) => (
          <button
            key={label}
            onClick={() => setTab(idx as 0 | 1)}
            className={`py-2.5 px-5 text-base border-b-2 -mb-px transition-colors
              ${tab === idx ? 'border-primary text-primary font-medium' : 'border-transparent text-secondary hover:text-primary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  Tab 0: 請求一覧                                              */}
      {/* ============================================================ */}
      {tab === 0 && (
        <>
          {/* 月ナビゲーター */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button onClick={() => setMonthOffset(o => o - 1)} className="text-secondary hover:text-primary text-lg px-2">&lt;</button>
            <span className="text-base font-medium min-w-[120px] text-center">{monthLabel}</span>
            <button onClick={() => setMonthOffset(o => o + 1)} className="text-secondary hover:text-primary text-lg px-2">&gt;</button>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="card p-4">
              <div className="text-xs text-secondary">請求合計</div>
              <div className="text-2xl font-medium tabular-nums">{fmt(total)}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary">入金済</div>
              <div className="text-2xl font-medium tabular-nums text-status-green-text">{fmt(paidTotal)}<span className="text-sm font-normal ml-1">円</span></div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary">未入金</div>
              <div className="text-2xl font-medium tabular-nums">{fmt(unpaid)}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary">入金遅延</div>
              <div className={`text-2xl font-medium tabular-nums ${overdueAmt > 0 ? 'text-status-red-text' : ''}`}>{fmt(overdueAmt)}<span className="text-sm font-normal ml-1">円</span></div>
            </div>
          </div>

          {/* テーブル */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">請求番号</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">クライアント</th>
                    <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">人数</th>
                    <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">請求金額(税込)</th>
                    <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">請求日</th>
                    <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">支払期日</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">送信先</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ステータス</th>
                    <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={9}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
                  ) : invoices.map(inv => {
                    const st = statusBadge[inv.status] || statusBadge.draft;
                    const totalWithTax = inv.totalAmount + inv.tax;
                    return (
                      <tr key={inv.id} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 text-base font-medium">{inv.invoiceNo}</td>
                        <td className="px-4 py-2.5 text-base">{inv.client.name}</td>
                        <td className="px-4 py-2.5 text-base text-right">{inv.items.length}名</td>
                        <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(totalWithTax)}円</td>
                        <td className="px-4 py-2.5 text-base text-right">{fmtDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-2.5 text-base text-right">{fmtDate(inv.dueDate)}</td>
                        <td className="px-4 py-2.5 text-base text-secondary">{inv.recipientEmail || '--'}</td>
                        <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => openPreview(inv)} className="btn-outline text-xs py-1 px-2">プレビュー</button>
                            {inv.status === 'draft' && (
                              <button onClick={() => handleStatusUpdate(inv.id, 'sent')} className="btn-outline text-xs py-1 px-2">送信</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  Tab 1: 請求書プレビュー                                       */}
      {/* ============================================================ */}
      {tab === 1 && (
        <>
          {/* アクション */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setTab(0)} className="btn-outline text-sm py-2">一覧に戻る</button>
            <div className="flex-1" />
            <button onClick={() => window.print()} className="btn-outline text-sm py-2">PDF保存</button>
            <button onClick={() => toast('メール送信はfreee連携で対応予定です')} className="btn-primary text-sm py-2">メール送信</button>
          </div>

          {!selectedInvoice ? (
            <div className="card p-10 text-center text-secondary">
              請求書を選択してください
            </div>
          ) : (
          <div className="card p-8 max-w-[820px] mx-auto">
            {/* タイトル */}
            <h2 className="text-2xl font-medium text-center mb-8">請求書</h2>

            {/* 宛先 + 発行者情報 */}
            <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
              <div>
                <div className="text-lg font-medium">{selectedInvoice.client.name}</div>
                <div className="text-base">御中</div>
              </div>
              <div className="text-right text-sm space-y-0.5">
                <div className="mt-3 space-y-0.5">
                  <div>請求番号: <span className="font-medium">{selectedInvoice.invoiceNo}</span></div>
                  <div>請求日: {fmtDate(selectedInvoice.invoiceDate)}</div>
                  <div>お支払期限: {fmtDate(selectedInvoice.dueDate)}</div>
                </div>
              </div>
            </div>

            {/* ご請求金額(税込) */}
            <div className="bg-page border border-border rounded-lg p-5 mb-8 text-center">
              <div className="text-sm text-secondary mb-1">ご請求金額（税込）</div>
              <div className="text-3xl font-medium tabular-nums">&yen;{fmt(selectedInvoice.totalAmount + selectedInvoice.tax)}</div>
            </div>

            {/* 明細テーブル */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left text-xs text-secondary font-normal px-3 py-2">技術者名</th>
                    <th className="text-left text-xs text-secondary font-normal px-3 py-2">業務内容</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">稼働時間</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">精算幅</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">単価（税抜）</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">超過精算</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">金額（税抜）</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((line) => (
                    <tr key={line.id} className="border-b border-border/30">
                      <td className="px-3 py-2.5 text-sm font-medium">{line.employeeName}</td>
                      <td className="px-3 py-2.5 text-sm">{line.description}</td>
                      <td className="px-3 py-2.5 text-sm text-right">{line.workHours ?? '--'}h</td>
                      <td className="px-3 py-2.5 text-sm text-right">{line.settlementLower && line.settlementUpper ? `${line.settlementLower}〜${line.settlementUpper}h` : '--'}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums">&yen;{fmt(line.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums">&yen;{fmt(line.overtimeAmount)}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums">&yen;{fmt(line.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 小計・税・合計 */}
            <div className="flex justify-end mb-8">
              <div className="w-full max-w-[320px] space-y-0">
                {[
                  ['税抜合計', selectedInvoice.totalAmount],
                  ['消費税（10%）', selectedInvoice.tax],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between py-1.5 border-b border-border/20 text-sm">
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">&yen;{fmt(value as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 border-b-2 border-border text-base font-medium">
                  <span>合計（税込）</span>
                  <span className="tabular-nums">&yen;{fmt(selectedInvoice.totalAmount + selectedInvoice.tax)}</span>
                </div>
              </div>
            </div>

            {/* 備考 */}
            {selectedInvoice.notes && (
              <div>
                <div className="text-xs text-secondary uppercase tracking-widest mb-2">備考</div>
                <div className="text-sm text-secondary whitespace-pre-line">{selectedInvoice.notes}</div>
              </div>
            )}
          </div>
          )}
        </>
      )}

      <ToastUI />
    </div>
  );
}
