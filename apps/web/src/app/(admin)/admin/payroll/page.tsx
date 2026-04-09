/**
 * 管理側 給与管理
 *
 * UIモックのpage-payrollを再現。
 * ステップバー（勤怠締め→給与計算→確認・修正→確定→振込・通知）+ 社員テーブル + 詳細パネル。
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';

const steps = ['勤怠締め', '給与計算', '確認・修正', '確定', '振込・通知'];
const currentStepIdx = 2;

/** API レスポンスの1件分 */
interface PayrollApiItem {
  id: string;
  employeeId: string;
  employee?: { name?: string; lastName?: string; firstName?: string };
  baseSalary: number | null;
  overtimePay: number | null;
  commuteAllowance: number | null;
  otherAllowance: number | null;
  grossSalary: number | null;
  healthInsurance: number | null;
  pension: number | null;
  employmentInsurance: number | null;
  incomeTax: number | null;
  residentTax: number | null;
  totalDeductions: number | null;
  netSalary: number | null;
  status: string;
  workingHours?: number;
  unitPrice?: number;
  ratio?: number;
  /** E: 給与可視性マスク。true のときは manager から見えない admin/他 manager の行。 */
  _masked?: boolean;
}

/** UI 用に整形した給与データ */
interface PayrollRow {
  id: string;
  name: string;
  unitPrice: number;
  ratio: number;
  gross: number | null;
  deductions: number | null;
  net: number | null;
  hours: number;
  hoursWarn: boolean;
  status: string;
  earnings: { label: string; amount: number | null }[];
  deductionItems: { label: string; amount: number | null }[];
  /** E: マスク行（manager から admin/他 manager の給与行） */
  masked: boolean;
}

/** API レスポンスを UI 行に変換 */
function toRow(item: PayrollApiItem): PayrollRow {
  const name =
    item.employee?.name ??
    (item.employee?.lastName && item.employee?.firstName
      ? `${item.employee.lastName} ${item.employee.firstName}`
      : `社員 ${item.employeeId}`);

  const hours = item.workingHours ?? 0;

  return {
    id: item.id,
    name,
    unitPrice: item.unitPrice ?? 0,
    ratio: item.ratio ?? 0,
    gross: item.grossSalary,
    deductions: item.totalDeductions,
    net: item.netSalary,
    hours,
    hoursWarn: hours > 180 || hours < 140,
    status: item.status ?? 'draft',
    masked: item._masked === true,
    earnings: [
      { label: '基本給', amount: item.baseSalary },
      { label: '残業手当', amount: item.overtimePay },
      { label: '通勤手当', amount: item.commuteAllowance },
      { label: 'その他手当', amount: item.otherAllowance },
    ],
    deductionItems: [
      { label: '健康保険', amount: item.healthInsurance },
      { label: '厚生年金', amount: item.pension },
      { label: '雇用保険', amount: item.employmentInsurance },
      { label: '所得税', amount: item.incomeTax },
      { label: '住民税', amount: item.residentTax },
    ],
  };
}

/** マスク対応のフォーマッタ: null は `****` で表示 */
function fmtMasked(n: number | null | undefined, masked = false): string {
  if (masked || n === null || n === undefined) return '****';
  return n.toLocaleString();
}

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '未確認', cls: 'badge-wait' },
  confirmed: { label: '確認済', cls: 'badge-ok' },
  paid: { label: '振込済', cls: 'badge-info' },
};

/** 対象月の選択肢を生成（当月から過去12ヶ月） */
function buildMonthOptions(): { value: string; label: string; year: number; month: number }[] {
  const now = new Date();
  const options: { value: string; label: string; year: number; month: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    options.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: `${y}年${m}月`,
      year: y,
      month: m,
    });
  }
  return options;
}

interface EditFormState {
  baseSalary: string;
  overtimePay: string;
  commuteAllowance: string;
  otherAllowance: string;
  healthInsurance: string;
  pension: string;
  employmentInsurance: string;
  incomeTax: string;
  residentTax: string;
  reason: string;
}

interface EditHistoryItem {
  id: string;
  fieldName: string;
  oldValue: number | null;
  newValue: number | null;
  reason: string | null;
  createdAt: string;
  editorName: string;
}

const fieldLabel: Record<string, string> = {
  baseSalary: '基本給',
  overtimePay: '残業手当',
  commuteAllowance: '通勤手当',
  otherAllowance: 'その他手当',
  healthInsurance: '健康保険',
  pension: '厚生年金',
  employmentInsurance: '雇用保険',
  incomeTax: '所得税',
  residentTax: '住民税',
};

export default function AdminPayrollPageWrapper() {
  // E: /admin/payroll は admin / manager のみアクセス可。member / employee はリダイレクト。
  return (
    <AuthGuard requiredRoles={['admin', 'manager']}>
      <AdminPayrollPage />
    </AuthGuard>
  );
}

function AdminPayrollPage() {
  const [payrollData, setPayrollData] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? payrollData.find(p => p.id === selectedId) : null;
  const { toast, ToastUI } = useToast();

  /* J6: 直接編集 + 履歴 */
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    baseSalary: '', overtimePay: '', commuteAllowance: '', otherAllowance: '',
    healthInsurance: '', pension: '', employmentInsurance: '', incomeTax: '', residentTax: '',
    reason: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /** 対象年月（デフォルトは現在月）— 月切替可能 */
  const monthOptions = buildMonthOptions();
  const [targetKey, setTargetKey] = useState<string>(monthOptions[0].value);
  const current = monthOptions.find(o => o.value === targetKey) || monthOptions[0];
  const targetYear = current.year;
  const targetMonth = current.month;

  /** 給与データを取得 */
  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<PayrollApiItem[]>(`/payroll/${targetYear}/${targetMonth}`);
      setPayrollData((Array.isArray(data) ? data : []).map(toRow));
    } catch {
      toast('給与データの取得に失敗しました');
      setPayrollData([]);
    } finally {
      setLoading(false);
    }
  }, [toast, targetYear, targetMonth]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  /** 総支給額合計（マスクされた行は除外） */
  const totalGross = payrollData.reduce((sum, p) => sum + (p.masked ? 0 : p.gross ?? 0), 0);

  const handleCalc = useCallback(async () => {
    try {
      await apiClient(`/payroll/${targetYear}/${targetMonth}/calc`, { method: 'POST' });
      toast('給与計算を実行しました');
      // 再取得して画面を更新
      await fetchPayroll();
    } catch {
      toast('給与計算の実行に失敗しました');
    }
  }, [toast, targetYear, targetMonth, fetchPayroll]);

  /* J6: 編集モード開始 */
  const openEditMode = () => {
    if (!selected) return;
    if (selected.status === 'confirmed') {
      toast('確定済みの給与は編集できません');
      return;
    }
    const getByLabel = (items: { label: string; amount: number | null }[], label: string) =>
      String(items.find(i => i.label === label)?.amount ?? 0);
    setEditForm({
      baseSalary: getByLabel(selected.earnings, '基本給'),
      overtimePay: getByLabel(selected.earnings, '残業手当'),
      commuteAllowance: getByLabel(selected.earnings, '通勤手当'),
      otherAllowance: getByLabel(selected.earnings, 'その他手当'),
      healthInsurance: getByLabel(selected.deductionItems, '健康保険'),
      pension: getByLabel(selected.deductionItems, '厚生年金'),
      employmentInsurance: getByLabel(selected.deductionItems, '雇用保険'),
      incomeTax: getByLabel(selected.deductionItems, '所得税'),
      residentTax: getByLabel(selected.deductionItems, '住民税'),
      reason: '',
    });
    setEditMode(true);
  };

  /* J6: 編集保存 */
  const handleSaveEdit = async () => {
    if (!selected) return;
    const payload: Record<string, any> = {};
    const fields: (keyof EditFormState)[] = [
      'baseSalary', 'overtimePay', 'commuteAllowance', 'otherAllowance',
      'healthInsurance', 'pension', 'employmentInsurance', 'incomeTax', 'residentTax',
    ];
    for (const f of fields) {
      const v = editForm[f];
      if (v === '') continue;
      const n = Number(String(v).replace(/,/g, ''));
      if (isNaN(n) || n < 0) {
        toast(`${fieldLabel[f]} は 0 以上の整数で入力してください`);
        return;
      }
      payload[f] = n;
    }
    if (editForm.reason) payload.reason = editForm.reason;

    setEditSaving(true);
    try {
      await apiClient(`/payroll/record/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast('給与を更新しました');
      setEditMode(false);
      await fetchPayroll();
      await fetchEditHistory(selected.id);
    } catch (err: any) {
      toast(err?.message || '給与の更新に失敗しました');
    } finally {
      setEditSaving(false);
    }
  };

  /* J6: 編集履歴を取得 */
  const fetchEditHistory = useCallback(async (payrollId: string) => {
    setHistoryLoading(true);
    try {
      const data = await apiClient<EditHistoryItem[]>(`/payroll/record/${payrollId}/history`);
      setEditHistory(Array.isArray(data) ? data : []);
    } catch {
      setEditHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /* 選択が変わったら編集モードを閉じ、履歴を再取得 */
  useEffect(() => {
    setEditMode(false);
    if (selectedId) {
      fetchEditHistory(selectedId);
    } else {
      setEditHistory([]);
    }
  }, [selectedId, fetchEditHistory]);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">給与管理</h1>
        <div className="flex gap-2 items-center">
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="border border-border/30 rounded-md px-3 py-1.5 text-sm bg-white outline-none focus:border-primary/40"
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="btn-outline text-sm py-1.5">明細一括PDF</button>
          <button onClick={handleCalc} className="btn-primary text-sm py-1.5">給与計算実行</button>
        </div>
      </div>

      {/* ステップバー */}
      <div className="flex gap-0 mb-5 overflow-x-auto">
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIdx;
          const isActive = idx === currentStepIdx;
          return (
            <div
              key={step}
              className={`flex-1 py-2.5 px-4 text-base text-center border-b-2 whitespace-nowrap
                ${isActive ? 'border-primary text-primary font-medium' : ''}
                ${isDone ? 'border-status-green-text text-status-green-text' : ''}
                ${!isActive && !isDone ? 'border-border/30 text-secondary' : ''}`}
            >
              {step}
            </div>
          );
        })}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">対象月</div>
          <div className="text-xl font-medium">{targetYear}年{targetMonth}月</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">総支給額合計</div>
          <div className="text-2xl font-medium tabular-nums">{payrollData.length > 0 ? fmt(totalGross) : '--'}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">対象人数</div>
          <div className="text-3xl font-medium">{payrollData.length}<span className="text-base font-normal text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">ステータス</div>
          <div className="mt-1"><span className="badge badge-info">確認中</span></div>
        </div>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[850px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">契約単価</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">還元率</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">総支給額</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">控除合計</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">差引支給額</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : payrollData.length === 0 ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : payrollData.map(p => {
              const st = statusBadge[p.status] ?? statusBadge.draft;
              // E: マスク行は選択不可・灰色背景で「閲覧権限なし」を示唆
              const rowClass = p.masked
                ? 'border-b border-border/20 bg-[#F5F5F3] opacity-70 cursor-not-allowed'
                : 'border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors';
              return (
                <tr
                  key={p.id}
                  onClick={() => !p.masked && setSelectedId(p.id)}
                  className={rowClass}
                  title={p.masked ? '閲覧権限がありません' : undefined}
                >
                  <td className="px-4 py-2.5 text-base font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-base text-right">{p.ratio}%</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmtMasked(p.gross, p.masked)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmtMasked(p.deductions, p.masked)}</td>
                  <td className={`px-4 py-2.5 text-base text-right tabular-nums font-medium ${p.masked ? '' : 'bg-yellow-50'}`}>{fmtMasked(p.net, p.masked)}</td>
                  <td className={`px-4 py-2.5 text-base text-right tabular-nums ${p.hoursWarn ? 'text-status-red-text font-medium' : ''}`}>{p.hours}h</td>
                  <td className="px-4 py-2.5">
                    {p.masked ? (
                      <span className="badge bg-[#E8E8E6] text-secondary">閲覧不可</span>
                    ) : (
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 詳細パネル */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => { setSelectedId(null); setEditMode(false); }} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <div className="text-xl font-medium">{selected.name}</div>
                <div className="text-sm text-secondary">{targetYear}年{targetMonth}月分</div>
              </div>
              <button onClick={() => { setSelectedId(null); setEditMode(false); }} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              {editMode ? (
                /* J6: 編集モード */
                <div className="space-y-4">
                  <div className="text-xs text-secondary bg-[#FFFBEB] border border-[#F0C674] rounded-md p-2">
                    給与を直接編集すると、差分が編集履歴として記録されます。
                    総支給額・控除合計・差引支給額は保存後に自動再計算されます。
                  </div>
                  <div>
                    <div className="text-2xs text-secondary uppercase tracking-widest mb-2">支給</div>
                    {(['baseSalary', 'overtimePay', 'commuteAllowance', 'otherAllowance'] as const).map(k => (
                      <div key={k} className="flex items-center justify-between py-1.5 border-b border-border/20 text-sm">
                        <span className="text-secondary">{fieldLabel[k]}</span>
                        <input
                          type="number"
                          className="w-32 text-right tabular-nums h-8 px-2 rounded border border-border/30 focus:border-primary focus:outline-none"
                          value={editForm[k]}
                          onChange={(e) => setEditForm(f => ({ ...f, [k]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-2xs text-secondary uppercase tracking-widest mb-2">控除</div>
                    {(['healthInsurance', 'pension', 'employmentInsurance', 'incomeTax', 'residentTax'] as const).map(k => (
                      <div key={k} className="flex items-center justify-between py-1.5 border-b border-border/20 text-sm">
                        <span className="text-secondary">{fieldLabel[k]}</span>
                        <input
                          type="number"
                          className="w-32 text-right tabular-nums h-8 px-2 rounded border border-border/30 focus:border-primary focus:outline-none"
                          value={editForm[k]}
                          onChange={(e) => setEditForm(f => ({ ...f, [k]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-2xs text-secondary uppercase tracking-widest mb-1 block">変更理由（任意）</label>
                    <input
                      type="text"
                      className="w-full h-9 px-3 rounded border border-border/30 text-sm focus:border-primary focus:outline-none"
                      placeholder="例: 経費反映漏れを修正"
                      value={editForm.reason}
                      onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setEditMode(false)}
                      className="btn-outline flex-1 text-sm py-2"
                      disabled={editSaving}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                      className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                    >
                      {editSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-2xs text-secondary uppercase tracking-widest mb-2">支給</div>
                    {selected.earnings.map(item => (
                      <div key={item.label} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                        <span className="text-secondary">{item.label}</span><span className="tabular-nums">{fmt(item.amount)}円</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-2xs text-secondary uppercase tracking-widest mb-2">控除</div>
                    {selected.deductionItems.map(item => (
                      <div key={item.label} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                        <span className="text-secondary">{item.label}</span><span className="tabular-nums">{fmt(item.amount)}円</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-yellow-50 rounded-md p-3">
                    <div className="text-2xs text-secondary uppercase tracking-widest mb-2">差引支給額</div>
                    <div className="text-2xl font-medium tabular-nums">{fmt(selected.net)}円</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => window.print()} className="btn-outline flex-1 text-sm py-2">PDF出力</button>
                    <button
                      onClick={openEditMode}
                      disabled={selected.status === 'confirmed'}
                      className="btn-outline flex-1 text-sm py-2 disabled:opacity-50"
                    >
                      直接編集
                    </button>
                  </div>

                  {/* J6: 編集履歴 */}
                  <div>
                    <div className="text-2xs text-secondary uppercase tracking-widest mb-2">編集履歴</div>
                    {historyLoading ? (
                      <div className="text-xs text-secondary py-3 text-center">読み込み中...</div>
                    ) : editHistory.length === 0 ? (
                      <div className="text-xs text-secondary py-3 text-center">編集履歴はありません</div>
                    ) : (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto">
                        {editHistory.map(h => (
                          <div key={h.id} className="text-xs bg-[#F7F7F5] rounded-md p-2 space-y-1">
                            <div className="flex justify-between">
                              <span className="font-medium text-primary">
                                {fieldLabel[h.fieldName] || h.fieldName}
                              </span>
                              <span className="text-secondary">
                                {new Date(h.createdAt).toLocaleString('ja-JP')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 tabular-nums">
                              <span className="text-secondary line-through">{fmt(h.oldValue)}円</span>
                              <span>→</span>
                              <span className="font-medium">{fmt(h.newValue)}円</span>
                            </div>
                            <div className="flex justify-between text-secondary">
                              <span>編集者: {h.editorName}</span>
                              {h.reason && <span>理由: {h.reason}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      <ToastUI />
    </div>
  );
}
