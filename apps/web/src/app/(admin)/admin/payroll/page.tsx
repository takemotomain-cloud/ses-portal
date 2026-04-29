/**
 * 管理側 給与管理
 *
 * UIモックのpage-payrollを再現。
 * ステップバー（勤怠確認→確認・修正→確定・通知→振込）+ 社員テーブル + 詳細パネル。
 * 給与計算は勤怠確定時に自動実行される。
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';

const steps = ['勤怠確認', '確認・修正', '確定・通知', '振込'];

/** API レスポンスの1件分 */
interface PayrollApiItem {
  id: string;
  employeeId: string;
  employee?: { name?: string; lastName?: string; firstName?: string };
  baseSalary: number | null;
  fixedOvertimePay: number | null;
  fixedOvertimeHours: number | null;
  absenceDeduction: number | null;
  overtimePay: number | null;
  regularOvertimePay: number | null;
  excessOvertimePay: number | null;
  lateNightPay: number | null;
  holidayPay: number | null;
  commuteAllowance: number | null;
  expenseReimbursement: number | null;
  otherAllowance: number | null;
  grossSalary: number | null;
  standardRemunerationGrade: number | null;
  standardMonthlyRemuneration: number | null;
  healthInsurance: number | null;
  nursingCareInsurance: number | null;
  pension: number | null;
  employmentInsurance: number | null;
  incomeTax: number | null;
  residentTax: number | null;
  totalDeductions: number | null;
  netSalary: number | null;
  businessDays: number | null;
  actualWorkDays: number | null;
  overtimeWarnings: string[] | null;
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
  employeeId: string;
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
  businessDays: number | null;
  actualWorkDays: number | null;
  warnings: string[];
}

/** API レスポンスを UI 行に変換 */
function toRow(item: PayrollApiItem): PayrollRow {
  const name =
    item.employee?.name ??
    (item.employee?.lastName && item.employee?.firstName
      ? `${item.employee.lastName} ${item.employee.firstName}`
      : `社員 ${item.employeeId}`);

  const hours = item.workingHours ?? 0;

  // 検証アラート
  const warnings: string[] = [];
  if (
    item.businessDays !== null && item.actualWorkDays !== null &&
    item.actualWorkDays < item.businessDays
  ) {
    warnings.push(`稼働不足（${item.actualWorkDays}日 / 所定${item.businessDays}日）`);
  }
  if (item.commuteAllowance === 0 || item.commuteAllowance === null) {
    warnings.push('交通費未入力');
  }
  // 36協定警告をマージ
  if (item.overtimeWarnings && Array.isArray(item.overtimeWarnings)) {
    warnings.push(...item.overtimeWarnings);
  }

  // 固定残業手当ラベル（時間数があれば表示）
  const fixedOtLabel = item.fixedOvertimeHours
    ? `固定残業手当（${item.fixedOvertimeHours}時間分）`
    : '固定残業手当';

  // 残業内訳（内訳がある場合は展開、なければ合計のみ）
  const hasOtBreakdown = (item.regularOvertimePay ?? 0) > 0 || (item.excessOvertimePay ?? 0) > 0
    || (item.lateNightPay ?? 0) > 0 || (item.holidayPay ?? 0) > 0;

  const earningsItems: { label: string; amount: number | null }[] = [
    { label: '基本給', amount: item.baseSalary },
    { label: fixedOtLabel, amount: item.fixedOvertimePay },
    { label: '欠勤控除', amount: item.absenceDeduction ? -(item.absenceDeduction) : 0 },
  ];

  if (hasOtBreakdown) {
    earningsItems.push(
      { label: '通常残業手当（1.25倍）', amount: item.regularOvertimePay },
      { label: '超過残業手当（1.50倍）', amount: item.excessOvertimePay },
      { label: '深夜手当（+0.25倍）', amount: item.lateNightPay },
      { label: '休日手当（1.35倍）', amount: item.holidayPay },
    );
  } else {
    earningsItems.push({ label: '超過残業手当', amount: item.overtimePay });
  }

  earningsItems.push(
    { label: '通勤手当', amount: item.commuteAllowance },
    { label: '経費精算', amount: item.expenseReimbursement },
    { label: 'その他手当', amount: item.otherAllowance },
  );

  return {
    id: item.id,
    name,
    unitPrice: item.unitPrice ?? 0,
    ratio: item.ratio ?? 0,
    employeeId: item.employeeId,
    gross: item.grossSalary,
    deductions: item.totalDeductions,
    net: item.netSalary,
    hours,
    hoursWarn: hours > 180 || hours < 140,
    status: item.status ?? 'draft',
    masked: item._masked === true,
    businessDays: item.businessDays,
    actualWorkDays: item.actualWorkDays,
    warnings,
    earnings: earningsItems,
    deductionItems: [
      { label: '健康保険', amount: item.healthInsurance },
      { label: '介護保険', amount: item.nursingCareInsurance },
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

/** 交通費申請（給与ページ内承認用） */
interface ExpenseRequestForPayroll {
  id: string;
  employeeId: string;
  targetMonth: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: {
    kind: string;
    expenseDate: string;
    passEndDate: string | null;
    departure: string;
    destination: string;
    amount: number;
    receiptPath: string | null;
    receiptName: string | null;
  }[];
}

const kindLabel: Record<string, string> = {
  onetime: '都度',
  monthly_pass: '1ヶ月定期',
  three_month_pass: '3ヶ月定期',
};

interface EditFormState {
  baseSalary: string;
  fixedOvertimePay: string;
  absenceDeduction: string;
  overtimePay: string;
  commuteAllowance: string;
  expenseReimbursement: string;
  otherAllowance: string;
  healthInsurance: string;
  nursingCareInsurance: string;
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
  fixedOvertimePay: '固定残業手当',
  absenceDeduction: '欠勤控除',
  overtimePay: '超過残業手当',
  commuteAllowance: '通勤手当',
  expenseReimbursement: '経費精算',
  otherAllowance: 'その他手当',
  healthInsurance: '健康保険',
  nursingCareInsurance: '介護保険',
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
    baseSalary: '', fixedOvertimePay: '', absenceDeduction: '', overtimePay: '', commuteAllowance: '', expenseReimbursement: '', otherAllowance: '',
    healthInsurance: '', nursingCareInsurance: '', pension: '', employmentInsurance: '', incomeTax: '', residentTax: '',
    reason: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 交通費申請データ（承認用）
  const [expenseRequests, setExpenseRequests] = useState<ExpenseRequestForPayroll[]>([]);
  const [expenseActioning, setExpenseActioning] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  /** 対象年月（デフォルトは現在月）— 月切替可能 */
  const monthOptions = buildMonthOptions();
  const [targetKey, setTargetKey] = useState<string>(monthOptions[0].value);
  const current = monthOptions.find(o => o.value === targetKey) || monthOptions[0];
  const targetYear = current.year;
  const targetMonth = current.month;

  /** ステップバーの現在位置 */
  const currentStepIdx = (() => {
    if (payrollData.length === 0 || payrollData.every(p => p.gross === null || p.gross === 0)) return 0;
    if (payrollData.every(p => p.status === 'paid')) return 3;
    if (payrollData.some(p => p.status === 'confirmed')) return 2;
    return 1;
  })();

  /** 給与データを取得 */
  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const [data, allExpenses] = await Promise.all([
        apiClient<PayrollApiItem[]>(`/payroll/${targetYear}/${targetMonth}`),
        apiClient<ExpenseRequestForPayroll[]>(
          `/expense/all?year=${targetYear}&month=${targetMonth}`,
        ).catch(() => [] as ExpenseRequestForPayroll[]),
      ]);
      setExpenseRequests(allExpenses);

      // 社員ごとの未承認/承認済み交通費
      const pendingMap = new Map<string, number>();
      const approvedSet = new Set<string>();
      for (const e of allExpenses) {
        if (e.status === 'pending') {
          pendingMap.set(e.employeeId, (pendingMap.get(e.employeeId) || 0) + 1);
        }
        if (e.status === 'approved') {
          approvedSet.add(e.employeeId);
        }
      }
      const rows = (Array.isArray(data) ? data : []).map(toRow);
      // 交通費警告を調整
      for (const row of rows) {
        if (approvedSet.has(row.employeeId)) {
          const idx = row.warnings.indexOf('交通費未入力');
          if (idx !== -1) row.warnings.splice(idx, 1);
        }
        const cnt = pendingMap.get(row.employeeId) || 0;
        if (cnt > 0) {
          row.warnings.push(`未承認の交通費申請あり（${cnt}件）`);
        }
      }
      setPayrollData(rows);
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

  // 選択中社員の交通費申請
  const selectedExpenses = selected
    ? expenseRequests.filter(e => e.employeeId === selected.employeeId)
    : [];

  async function handleExpenseApprove(expenseId: string) {
    setExpenseActioning(expenseId);
    try {
      await apiClient(`/expense/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast('承認しました');
      fetchPayroll();
    } catch (err: any) {
      toast(err?.message || '承認に失敗しました');
    } finally {
      setExpenseActioning(null);
    }
  }

  async function handleExpenseReject(expenseId: string) {
    if (!rejectReason.trim()) return;
    setExpenseActioning(expenseId);
    try {
      await apiClient(`/expense/${expenseId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      toast('却下しました');
      setRejectTarget(null);
      setRejectReason('');
      fetchPayroll();
    } catch (err: any) {
      toast(err?.message || '却下に失敗しました');
    } finally {
      setExpenseActioning(null);
    }
  }

  /** 総支給額合計（マスクされた行は除外） */
  const totalGross = payrollData.reduce((sum, p) => sum + (p.masked ? 0 : p.gross ?? 0), 0);

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
      fixedOvertimePay: getByLabel(selected.earnings, '固定残業手当'),
      absenceDeduction: String(Math.abs(selected.earnings.find(i => i.label === '欠勤控除')?.amount ?? 0)),
      overtimePay: getByLabel(selected.earnings, '超過残業手当'),
      commuteAllowance: getByLabel(selected.earnings, '通勤手当'),
      expenseReimbursement: getByLabel(selected.earnings, '経費精算'),
      otherAllowance: getByLabel(selected.earnings, 'その他手当'),
      healthInsurance: getByLabel(selected.deductionItems, '健康保険'),
      nursingCareInsurance: getByLabel(selected.deductionItems, '介護保険'),
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
      'baseSalary', 'overtimePay', 'commuteAllowance', 'expenseReimbursement', 'otherAllowance',
      'healthInsurance', 'nursingCareInsurance', 'pension', 'employmentInsurance', 'incomeTax', 'residentTax',
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
    if (!editForm.reason.trim()) {
      toast('変更理由を入力してください');
      return;
    }
    payload.reason = editForm.reason.trim();

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

  /* 個別確定 */
  const [confirming, setConfirming] = useState(false);
  const handleConfirmRecord = async () => {
    if (!selected || selected.status === 'confirmed') return;
    setConfirming(true);
    try {
      await apiClient(`/payroll/record/${selected.id}/confirm`, { method: 'POST' });
      toast('給与を確定しました');
      await fetchPayroll();
    } catch (err: any) {
      toast(err?.message || '確定に失敗しました');
    } finally {
      setConfirming(false);
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
          <div className="mt-1">
            {(() => {
              if (payrollData.length === 0 || payrollData.every(p => p.gross === null || p.gross === 0)) return <span className="badge badge-wait">計算待ち</span>;
              if (payrollData.every(p => p.status === 'confirmed' || p.status === 'paid')) return <span className="badge badge-ok">確定済</span>;
              if (payrollData.some(p => p.status === 'confirmed')) return <span className="badge badge-info">一部確定</span>;
              return <span className="badge badge-info">確認中</span>;
            })()}
          </div>
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
                  <td className="px-4 py-2.5 text-base font-medium">
                    {p.name}
                    {p.warnings.length > 0 && (
                      <span className="ml-1.5 text-status-red-text text-sm" title={p.warnings.join('\n')}>⚠</span>
                    )}
                  </td>
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
                    {(['baseSalary', 'fixedOvertimePay', 'absenceDeduction', 'overtimePay', 'commuteAllowance', 'expenseReimbursement', 'otherAllowance'] as const).map(k => (
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
                    {(['healthInsurance', 'nursingCareInsurance', 'pension', 'employmentInsurance', 'incomeTax', 'residentTax'] as const).map(k => (
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
                    <label className="text-2xs text-secondary uppercase tracking-widest mb-1 block">変更理由 <span className="text-[#A32D2D]">*</span></label>
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
                  {/* 検証アラート */}
                  {selected.warnings.length > 0 && (
                    <div className="bg-status-red-bg border border-status-red-text/20 rounded-md p-3 space-y-1">
                      {selected.warnings.map((w, i) => (
                        <div key={i} className="text-sm text-status-red-text flex items-center gap-1.5">
                          <span>⚠</span><span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 交通費申請（承認/却下） */}
                  {selectedExpenses.length > 0 && (
                    <div>
                      <div className="text-2xs text-secondary uppercase tracking-widest mb-2">交通費申請</div>
                      <div className="space-y-2">
                        {selectedExpenses.map(exp => (
                          <div key={exp.id} className="border border-border/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                exp.status === 'pending' ? 'bg-yellow-50 text-yellow-700'
                                : exp.status === 'approved' ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                              }`}>
                                {exp.status === 'pending' ? '未承認' : exp.status === 'approved' ? '承認済' : '却下'}
                              </span>
                              <span className="text-sm font-medium tabular-nums">{exp.totalAmount.toLocaleString()}円</span>
                            </div>
                            {exp.items.map((it, i) => (
                              <div key={i} className="text-xs text-secondary">
                                <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {kindLabel[it.kind] || it.kind}
                                </span>
                                {it.departure} → {it.destination}
                                <span className="ml-1 tabular-nums">{it.amount.toLocaleString()}円</span>
                                {it.receiptPath && (
                                  <a
                                    href={it.receiptPath.startsWith('/') ? it.receiptPath : `/uploads/expense-receipts/${it.receiptPath}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-primary underline"
                                  >領収書</a>
                                )}
                              </div>
                            ))}
                            {exp.status === 'pending' && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleExpenseApprove(exp.id)}
                                  disabled={expenseActioning === exp.id}
                                  className="flex-1 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  承認
                                </button>
                                <button
                                  onClick={() => { setRejectTarget(exp.id); setRejectReason(''); }}
                                  disabled={expenseActioning === exp.id}
                                  className="flex-1 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                                >
                                  却下
                                </button>
                              </div>
                            )}
                            {rejectTarget === exp.id && (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  value={rejectReason}
                                  onChange={e => setRejectReason(e.target.value)}
                                  placeholder="却下理由を入力..."
                                  className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary resize-none"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setRejectTarget(null)}
                                    className="flex-1 py-1.5 text-xs rounded-lg border border-border text-secondary hover:bg-page"
                                  >
                                    キャンセル
                                  </button>
                                  <button
                                    onClick={() => handleExpenseReject(exp.id)}
                                    disabled={!rejectReason.trim() || expenseActioning === exp.id}
                                    className="flex-1 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                                  >
                                    却下する
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 出勤日数 */}
                  {selected.businessDays !== null && (
                    <div className="text-xs text-secondary">
                      出勤 {selected.actualWorkDays ?? 0}日 / 所定 {selected.businessDays}日
                    </div>
                  )}
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
                    <button
                      onClick={openEditMode}
                      disabled={selected.status === 'confirmed'}
                      className="btn-outline flex-1 text-sm py-2 disabled:opacity-50"
                    >
                      直接編集
                    </button>
                    {selected.status === 'confirmed' ? (
                      <span className="badge badge-ok flex-1 text-center py-2">確定済</span>
                    ) : (
                      <button
                        onClick={handleConfirmRecord}
                        disabled={confirming || selected.gross === null}
                        className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                      >
                        {confirming ? '確定中...' : '確定'}
                      </button>
                    )}
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
