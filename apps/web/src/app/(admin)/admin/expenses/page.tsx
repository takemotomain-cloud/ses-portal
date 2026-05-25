/**
 * 管理側 経費精算
 *
 * 事前申請 + 一般経費の管理。承認/却下 + 詳細パネル。
 * ※交通費の承認は給与管理ページで行う
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

function formatJapaneseDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: '承認待ち', cls: 'badge-warn' },
  approved: { label: '承認済', cls: 'badge-ok' },
  rejected: { label: '却下', cls: 'badge-danger' },
};

/** 事前申請レスポンス */
interface PreApprovalResponse {
  id: string;
  employeeId: string;
  expectedDate: string;
  description: string;
  estimatedAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  approverId: string | null;
  approvedAt: string | null;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
  generalExpenses: { id: string }[];
}

/** 一般経費レスポンス */
interface GeneralExpenseResponse {
  id: string;
  employeeId: string;
  expenseDate: string;
  description: string;
  amount: number;
  receiptPath: string | null;
  receiptName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
  preApproval: { id: string; description: string; expectedDate: string; estimatedAmount: number } | null;
}

export default function AdminExpensesPage() {
  const { toast, ToastUI } = useToast();

  // 事前申請
  const [preApprovals, setPreApprovals] = useState<PreApprovalResponse[]>([]);
  const [paLoading, setPaLoading] = useState(true);
  const [paFilter, setPaFilter] = useState('');
  const [paSelected, setPaSelected] = useState<PreApprovalResponse | null>(null);
  const [paRejectTarget, setPaRejectTarget] = useState<PreApprovalResponse | null>(null);
  const [paRejectReason, setPaRejectReason] = useState('');

  // 一般経費
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpenseResponse[]>([]);
  const [generalLoading, setGeneralLoading] = useState(true);
  const [generalFilter, setGeneralFilter] = useState('');
  const [generalSelected, setGeneralSelected] = useState<GeneralExpenseResponse | null>(null);
  const [generalRejectTarget, setGeneralRejectTarget] = useState<GeneralExpenseResponse | null>(null);
  const [generalRejectReason, setGeneralRejectReason] = useState('');

  // タブ: 'pre-approval' | 'general'
  const [tab, setTab] = useState<'pre-approval' | 'general'>('pre-approval');

  const [actionLoading, setActionLoading] = useState(false);

  // 事前申請取得
  const fetchPreApprovals = useCallback(async () => {
    setPaLoading(true);
    try {
      const statusParam = paFilter ? `?status=${paFilter}` : '';
      const data = await apiClient<PreApprovalResponse[]>(`/general-expense/pre-approval/all${statusParam}`);
      setPreApprovals(data);
    } catch {
      setPreApprovals([]);
    } finally {
      setPaLoading(false);
    }
  }, [paFilter]);

  useEffect(() => { fetchPreApprovals(); }, [fetchPreApprovals]);

  async function handlePaApprove(id: string) {
    setActionLoading(true);
    try {
      await apiClient(`/general-expense/pre-approval/${id}/approve`, { method: 'POST', body: JSON.stringify({}) });
      toast('承認しました');
      fetchPreApprovals();
      if (paSelected?.id === id) setPaSelected(null);
    } catch (err: any) {
      toast(err?.message || '承認に失敗しました');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePaReject() {
    if (!paRejectTarget) return;
    setActionLoading(true);
    try {
      await apiClient(`/general-expense/pre-approval/${paRejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: paRejectReason }),
      });
      toast('却下しました');
      setPaRejectTarget(null);
      setPaRejectReason('');
      fetchPreApprovals();
      if (paSelected?.id === paRejectTarget.id) setPaSelected(null);
    } catch (err: any) {
      toast(err?.message || '却下に失敗しました');
    } finally {
      setActionLoading(false);
    }
  }

  // 一般経費取得
  const fetchGeneral = useCallback(async () => {
    setGeneralLoading(true);
    try {
      const statusParam = generalFilter ? `?status=${generalFilter}` : '';
      const data = await apiClient<GeneralExpenseResponse[]>(`/general-expense/all${statusParam}`);
      setGeneralExpenses(data);
    } catch {
      setGeneralExpenses([]);
    } finally {
      setGeneralLoading(false);
    }
  }, [generalFilter]);

  useEffect(() => { fetchGeneral(); }, [fetchGeneral]);

  async function handleGeneralApprove(id: string) {
    setActionLoading(true);
    try {
      await apiClient(`/general-expense/${id}/approve`, { method: 'POST', body: JSON.stringify({}) });
      toast('承認しました');
      fetchGeneral();
      if (generalSelected?.id === id) setGeneralSelected(null);
    } catch (err: any) {
      toast(err?.message || '承認に失敗しました');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGeneralReject() {
    if (!generalRejectTarget) return;
    setActionLoading(true);
    try {
      await apiClient(`/general-expense/${generalRejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: generalRejectReason }),
      });
      toast('却下しました');
      setGeneralRejectTarget(null);
      setGeneralRejectReason('');
      fetchGeneral();
      if (generalSelected?.id === generalRejectTarget.id) setGeneralSelected(null);
    } catch (err: any) {
      toast(err?.message || '却下に失敗しました');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">経費精算</h1>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {[
          { key: 'pre-approval' as const, label: '事前申請' },
          { key: 'general' as const, label: '一般経費' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pre-approval' ? (
        <>
          {/* 事前申請 KPI */}
          {(() => {
            const pTotal = preApprovals.length;
            const pPending = preApprovals.filter(e => e.status === 'pending').length;
            const pApproved = preApprovals.filter(e => e.status === 'approved').length;
            const pRejected = preApprovals.filter(e => e.status === 'rejected').length;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="card p-4">
                  <div className="text-xs text-secondary">申請合計</div>
                  <div className="text-3xl font-medium">{pTotal}<span className="text-base font-normal text-secondary ml-1">件</span></div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-secondary">承認待ち</div>
                  <div className="text-3xl font-medium text-status-amber-text">{pPending}<span className="text-base font-normal ml-1">件</span></div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-secondary">承認済</div>
                  <div className="text-3xl font-medium">{pApproved}<span className="text-base font-normal text-secondary ml-1">件</span></div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-secondary">却下</div>
                  <div className="text-3xl font-medium">{pRejected}<span className="text-base font-normal text-secondary ml-1">件</span></div>
                </div>
              </div>
            );
          })()}

          {/* フィルタ */}
          <div className="flex gap-2 mb-4">
            <select value={paFilter} onChange={e => setPaFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
              <option value="">ステータス: すべて</option>
              <option value="pending">承認待ち</option>
              <option value="approved">承認済</option>
              <option value="rejected">却下</option>
            </select>
          </div>

          {/* 事前申請テーブル */}
          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-border">
                {['申請者', '内容', '見積金額', '予定日', 'ステータス', '操作'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {paLoading ? (
                  <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
                ) : preApprovals.length === 0 ? (
                  <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
                ) : preApprovals.map(pa => {
                  const st = statusBadge[pa.status];
                  return (
                    <tr
                      key={pa.id}
                      className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer"
                      onClick={() => setPaSelected(pa)}
                    >
                      <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{pa.employee.lastName} {pa.employee.firstName}</td>
                      <td className="px-4 py-2.5 text-sm truncate max-w-[200px]">{pa.description}</td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums">{fmt(pa.estimatedAmount)}円</td>
                      <td className="px-4 py-2.5 text-sm text-secondary">{formatJapaneseDate(pa.expectedDate)}</td>
                      <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                        {pa.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handlePaApprove(pa.id)} disabled={actionLoading}
                              className="text-xs py-1 px-2.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">承認</button>
                            <button onClick={() => { setPaRejectTarget(pa); setPaRejectReason(''); }} disabled={actionLoading}
                              className="text-xs py-1 px-2.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">却下</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 事前申請詳細パネル */}
          {paSelected && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={() => setPaSelected(null)} />
              <div className="relative bg-card w-full max-w-[520px] h-full overflow-y-auto shadow-xl">
                <div className="sticky top-0 bg-card border-b border-border/20 px-5 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg font-medium">事前申請詳細</h2>
                  <button onClick={() => setPaSelected(null)} className="text-secondary hover:text-primary text-xl">×</button>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex justify-between text-sm"><span className="text-secondary">申請者</span><span className="font-medium">{paSelected.employee.lastName} {paSelected.employee.firstName}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-secondary">社員番号</span><span>{paSelected.employee.employeeCode}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-secondary">発生予定日</span><span>{formatJapaneseDate(paSelected.expectedDate)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-secondary">ステータス</span><span className={`badge ${statusBadge[paSelected.status].cls}`}>{statusBadge[paSelected.status].label}</span></div>
                  <div className="text-sm"><span className="text-secondary">内容</span><p className="mt-1">{paSelected.description}</p></div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border"><span>見積金額</span><span className="tabular-nums">{fmt(paSelected.estimatedAmount)}円</span></div>
                  <div className="flex justify-between text-sm"><span className="text-secondary">申請日</span><span>{formatJapaneseDate(paSelected.createdAt)}</span></div>
                  {paSelected.generalExpenses.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="text-xs text-blue-600 font-medium mb-1">紐づく経費申請</div>
                      <div className="text-blue-700">{paSelected.generalExpenses.length}件の経費申請があります</div>
                    </div>
                  )}
                  {paSelected.rejectReason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <div className="text-xs text-red-600 font-medium mb-1">却下理由</div>
                      <div className="text-red-700">{paSelected.rejectReason}</div>
                    </div>
                  )}
                  {paSelected.status === 'pending' && (
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => handlePaApprove(paSelected.id)} disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50">承認</button>
                      <button onClick={() => { setPaRejectTarget(paSelected); setPaRejectReason(''); }} disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50">却下</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 事前申請却下モーダル */}
          {paRejectTarget && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setPaRejectTarget(null)} />
              <div className="relative bg-card rounded-lg shadow-xl w-full max-w-[440px] mx-4">
                <div className="px-5 py-4 border-b border-border/20">
                  <h3 className="text-lg font-medium">事前申請を却下</h3>
                  <p className="text-sm text-secondary mt-1">
                    {paRejectTarget.employee.lastName} {paRejectTarget.employee.firstName}さんの申請（{fmt(paRejectTarget.estimatedAmount)}円）
                  </p>
                </div>
                <div className="px-5 py-4">
                  <label className="block text-sm font-medium mb-1.5">却下理由</label>
                  <textarea
                    value={paRejectReason}
                    onChange={e => setPaRejectReason(e.target.value)}
                    rows={3}
                    placeholder="却下理由を入力してください"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2 px-5 pb-4">
                  <button onClick={() => setPaRejectTarget(null)} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-page">キャンセル</button>
                  <button onClick={handlePaReject} disabled={actionLoading || !paRejectReason.trim()}
                    className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                    {actionLoading ? '処理中...' : '却下する'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 一般経費 KPI */}
          {(() => {
            const gTotal = generalExpenses.reduce((s, e) => s + e.amount, 0);
            const gPending = generalExpenses.filter(e => e.status === 'pending').length;
            const gApproved = generalExpenses.filter(e => e.status === 'approved').length;
            const gRejected = generalExpenses.filter(e => e.status === 'rejected').length;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="card p-4">
                  <div className="text-xs text-secondary">経費合計</div>
                  <div className="text-2xl font-medium tabular-nums">{fmt(gTotal)}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-secondary">承認待ち</div>
                  <div className="text-3xl font-medium text-status-amber-text">{gPending}<span className="text-base font-normal ml-1">件</span></div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-secondary">承認済</div>
                  <div className="text-3xl font-medium">{gApproved}<span className="text-base font-normal text-secondary ml-1">件</span></div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-secondary">却下</div>
                  <div className="text-3xl font-medium">{gRejected}<span className="text-base font-normal text-secondary ml-1">件</span></div>
                </div>
              </div>
            );
          })()}

          {/* フィルタ */}
          <div className="flex gap-2 mb-4">
            <select value={generalFilter} onChange={e => setGeneralFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
              <option value="">ステータス: すべて</option>
              <option value="pending">承認待ち</option>
              <option value="approved">承認済</option>
              <option value="rejected">却下</option>
            </select>
          </div>

          {/* 一般経費テーブル */}
          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-border">
                {['申請者', '内容', '金額', '利用日', 'ステータス', '操作'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {generalLoading ? (
                  <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
                ) : generalExpenses.length === 0 ? (
                  <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
                ) : generalExpenses.map(e => {
                  const st = statusBadge[e.status];
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer"
                      onClick={() => setGeneralSelected(e)}
                    >
                      <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{e.employee.lastName} {e.employee.firstName}</td>
                      <td className="px-4 py-2.5 text-sm truncate max-w-[200px]">{e.description}</td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums">{fmt(e.amount)}円</td>
                      <td className="px-4 py-2.5 text-sm text-secondary">{formatJapaneseDate(e.expenseDate)}</td>
                      <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-2.5" onClick={ev => ev.stopPropagation()}>
                        {e.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleGeneralApprove(e.id)} disabled={actionLoading}
                              className="text-xs py-1 px-2.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">承認</button>
                            <button onClick={() => { setGeneralRejectTarget(e); setGeneralRejectReason(''); }} disabled={actionLoading}
                              className="text-xs py-1 px-2.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">却下</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 一般経費詳細パネル */}
          {generalSelected && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/30" onClick={() => setGeneralSelected(null)} />
              <div className="relative bg-card w-full max-w-[520px] h-full overflow-y-auto shadow-xl">
                <div className="sticky top-0 bg-card border-b border-border/20 px-5 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg font-medium">経費申請詳細</h2>
                  <button onClick={() => setGeneralSelected(null)} className="text-secondary hover:text-primary text-xl">×</button>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex justify-between text-sm"><span className="text-secondary">申請者</span><span className="font-medium">{generalSelected.employee.lastName} {generalSelected.employee.firstName}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-secondary">利用日</span><span>{formatJapaneseDate(generalSelected.expenseDate)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-secondary">ステータス</span><span className={`badge ${statusBadge[generalSelected.status].cls}`}>{statusBadge[generalSelected.status].label}</span></div>
                  <div className="text-sm"><span className="text-secondary">内容</span><p className="mt-1">{generalSelected.description}</p></div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border"><span>金額</span><span className="tabular-nums">{fmt(generalSelected.amount)}円</span></div>
                  {generalSelected.preApproval && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="text-xs text-blue-600 font-medium mb-1">事前申請</div>
                      <div>{generalSelected.preApproval.description}</div>
                      <div className="text-xs text-secondary mt-0.5">
                        予定日: {formatJapaneseDate(generalSelected.preApproval.expectedDate)} / 見積: {fmt(generalSelected.preApproval.estimatedAmount)}円
                      </div>
                    </div>
                  )}
                  {generalSelected.receiptPath && (
                    <div>
                      {/\.(jpg|jpeg|png|gif|webp)$/i.test(generalSelected.receiptPath) ? (
                        <a href={generalSelected.receiptPath} target="_blank" rel="noopener noreferrer">
                          <img src={generalSelected.receiptPath} alt="領収書" className="h-32 rounded border border-border object-contain hover:opacity-80" />
                        </a>
                      ) : (
                        <a href={generalSelected.receiptPath} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          📄 {generalSelected.receiptName || 'ファイルを表示'}
                        </a>
                      )}
                    </div>
                  )}
                  {generalSelected.rejectReason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <div className="text-xs text-red-600 font-medium mb-1">却下理由</div>
                      <div className="text-red-700">{generalSelected.rejectReason}</div>
                    </div>
                  )}
                  {generalSelected.status === 'pending' && (
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => handleGeneralApprove(generalSelected.id)} disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50">承認</button>
                      <button onClick={() => { setGeneralRejectTarget(generalSelected); setGeneralRejectReason(''); }} disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50">却下</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 一般経費却下モーダル */}
          {generalRejectTarget && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setGeneralRejectTarget(null)} />
              <div className="relative bg-card rounded-lg shadow-xl w-full max-w-[440px] mx-4">
                <div className="px-5 py-4 border-b border-border/20">
                  <h3 className="text-lg font-medium">経費申請を却下</h3>
                  <p className="text-sm text-secondary mt-1">
                    {generalRejectTarget.employee.lastName} {generalRejectTarget.employee.firstName}さんの申請（{fmt(generalRejectTarget.amount)}円）
                  </p>
                </div>
                <div className="px-5 py-4">
                  <label className="block text-sm font-medium mb-1.5">却下理由</label>
                  <textarea
                    value={generalRejectReason}
                    onChange={e => setGeneralRejectReason(e.target.value)}
                    rows={3}
                    placeholder="却下理由を入力してください"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2 px-5 pb-4">
                  <button onClick={() => setGeneralRejectTarget(null)} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-page">キャンセル</button>
                  <button onClick={handleGeneralReject} disabled={actionLoading || !generalRejectReason.trim()}
                    className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                    {actionLoading ? '処理中...' : '却下する'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}


      <ToastUI />
    </div>
  );
}
