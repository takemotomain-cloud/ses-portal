/**
 * 管理側 請求管理
 *
 * 3タブ構成:
 * - 請求発行: 勤怠確定済み社員をクライアント別にグルーピング → 請求書発行
 * - 発行済み一覧: 発行済み請求書の一覧・ステータス管理
 * - 請求書プレビュー: 個別請求書の詳細表示
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  client: { id: string; name: string; address?: string; postalCode?: string; contactPerson?: string; contactEmail?: string; invoiceNumber?: string; representName?: string };
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

interface BillableEmployee {
  employeeId: string;
  employeeName: string;
  assignmentId: string;
  projectName: string;
  contractPrice: number;
  settlementLower: number;
  settlementUpper: number;
  totalWorkMinutes: number;
  totalWorkHours: number;
  baseAmount: number;
  overtimeAmount: number;
  deductionAmount: number;
  subtotal: number;
}

interface BillableGroup {
  clientId: string;
  clientName: string;
  targetMonth: string;
  employees: BillableEmployee[];
  totalAmount: number;
  employeeCount: number;
}

/* ------------------------------------------------------------------ */
/*  ヘルパー                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number | null | undefined) { return `${(n ?? 0).toLocaleString()}円`; }

/** 自社情報（請求書発行元） */
const ISSUER_DEFAULT = {
  name: '', postalCode: '', address1: '', address2: '', registrationNo: '',
  bankName: '', bankBranch: '', bankAccountType: '普通', bankAccountNumber: '', bankAccountHolder: '',
  sealImagePath: null as string | null,
};

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

/** 精算状況ラベル */
function settlementLabel(emp: BillableEmployee): { text: string; cls: string } {
  if (emp.overtimeAmount > 0) {
    return { text: `超過+${fmt(emp.overtimeAmount)}`, cls: 'text-status-amber-text' };
  }
  if (emp.deductionAmount > 0) {
    return { text: `控除-${fmt(emp.deductionAmount)}`, cls: 'text-status-red-text' };
  }
  return { text: '精算内', cls: 'text-status-green-text' };
}

/* ================================================================== */
/*  コンポーネント                                                      */
/* ================================================================== */

export default function AdminBillingPage() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const { toast, ToastUI } = useToast();

  // 発行済み一覧
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // 編集モード
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    invoiceDate: string;
    dueDate: string;
    notes: string;
    bankName: string;
    bankBranch: string;
    bankAccountType: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    items: {
      id?: string;
      employeeName: string;
      description: string;
      workHours: number;
      unitPrice: number;
      settlementLower: number;
      settlementUpper: number;
      overtimeAmount?: number;
      deductionAmount?: number;
      employeeId?: string;
      assignmentId?: string;
    }[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // 請求発行可能
  const [billableGroups, setBillableGroups] = useState<BillableGroup[]>([]);
  const [billableLoading, setBillableLoading] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, Set<string>>>({});
  const [generating, setGenerating] = useState(false);

  // 発行元情報（設定ページから取得）
  const [issuer, setIssuer] = useState(ISSUER_DEFAULT);
  useEffect(() => {
    apiClient<typeof ISSUER_DEFAULT>('/payroll/company-info')
      .then((data) => setIssuer(data))
      .catch(() => {});
  }, []);

  // 月ラベル
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthLabel = `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月`;
  const monthQuery = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

  /* ── データ取得 ── */

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

  const fetchBillable = useCallback(async () => {
    setBillableLoading(true);
    try {
      const data = await apiClient<{ billableGroups: BillableGroup[] }>(`/invoices/billable?month=${monthQuery}`);
      setBillableGroups(data.billableGroups || []);
      // 初期状態: 全クライアント展開、全社員選択
      const expanded = new Set<string>();
      const selected: Record<string, Set<string>> = {};
      for (const g of data.billableGroups || []) {
        expanded.add(g.clientId);
        selected[g.clientId] = new Set(g.employees.map((e) => e.employeeId));
      }
      setExpandedClients(expanded);
      setSelectedEmployees(selected);
    } catch {
      // エラー時は空表示
    } finally {
      setBillableLoading(false);
    }
  }, [monthQuery]);

  useEffect(() => {
    fetchInvoices();
    fetchBillable();
  }, [fetchInvoices, fetchBillable]);

  // KPI（発行済み一覧用）
  const total      = invoices.reduce((s, i) => s + i.totalAmount + i.tax, 0);
  const paidTotal  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount + i.tax, 0);
  const unpaid     = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.totalAmount + i.tax, 0);
  const overdueAmt = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount + i.tax, 0);

  /* ── ハンドラー ── */

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
    setEditing(false);
    setEditForm(null);
    setTab(2);
  }

  function openEdit(inv: Invoice) {
    setSelectedInvoice(inv);
    setEditForm({
      invoiceDate: inv.invoiceDate.slice(0, 10),
      dueDate: inv.dueDate.slice(0, 10),
      notes: inv.notes || '',
      bankName: issuer.bankName,
      bankBranch: issuer.bankBranch,
      bankAccountType: issuer.bankAccountType,
      bankAccountNumber: issuer.bankAccountNumber,
      bankAccountHolder: issuer.bankAccountHolder,
      items: inv.items.map((item) => ({
        id: item.id,
        employeeName: item.employeeName,
        description: item.description,
        workHours: Number(item.workHours || 0),
        unitPrice: item.unitPrice,
        settlementLower: item.settlementLower || 0,
        settlementUpper: item.settlementUpper || 0,
        overtimeAmount: item.overtimeAmount || undefined,
        deductionAmount: item.deductionAmount || undefined,
      })),
    });
    setEditing(true);
    setTab(2);
  }

  async function handleSaveEdit() {
    if (!selectedInvoice || !editForm) return;
    setSaving(true);
    try {
      const updated = await apiClient<Invoice>(`/invoices/${selectedInvoice.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setSelectedInvoice(updated);
      setEditing(false);
      setEditForm(null);
      toast('請求書を更新しました');
      fetchInvoices();
    } catch {
      toast('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  function updateEditItem(idx: number, field: string, value: number | string) {
    if (!editForm) return;
    setEditForm((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  }

  function addEditItem() {
    if (!editForm) return;
    setEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, { employeeName: '', description: '', workHours: 0, unitPrice: 0, settlementLower: 0, settlementUpper: 0, overtimeAmount: undefined, deductionAmount: undefined }],
      };
    });
  }

  function removeEditItem(idx: number) {
    if (!editForm || editForm.items.length <= 1) return;
    setEditForm((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== idx) };
    });
  }

  function toggleExpand(clientId: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function toggleEmployee(clientId: string, employeeId: string) {
    setSelectedEmployees((prev) => {
      const set = new Set(prev[clientId] || []);
      if (set.has(employeeId)) set.delete(employeeId);
      else set.add(employeeId);
      return { ...prev, [clientId]: set };
    });
  }

  function toggleAll(clientId: string, employees: BillableEmployee[]) {
    setSelectedEmployees((prev) => {
      const current = prev[clientId] || new Set();
      const allSelected = employees.every((e) => current.has(e.employeeId));
      if (allSelected) {
        return { ...prev, [clientId]: new Set() };
      } else {
        return { ...prev, [clientId]: new Set(employees.map((e) => e.employeeId)) };
      }
    });
  }

  async function handleGenerate(group: BillableGroup) {
    const selected = selectedEmployees[group.clientId];
    if (!selected || selected.size === 0) {
      toast('対象社員を選択してください');
      return;
    }

    const selectedEmps = group.employees.filter((e) => selected.has(e.employeeId));
    const subtotalSum = selectedEmps.reduce((s, e) => s + e.subtotal, 0);
    const taxAmount = Math.floor(subtotalSum * 0.1);
    const totalWithTax = subtotalSum + taxAmount;

    const msg = `請求書を発行しますか？\n\nクライアント: ${group.clientName}\n対象月: ${group.targetMonth}\n対象社員: ${selected.size}名\n請求金額(税抜): ${fmt(subtotalSum)}\n消費税(10%): ${fmt(taxAmount)}\n合計(税込): ${fmt(totalWithTax)}`;

    if (!confirm(msg)) return;

    setGenerating(true);
    try {
      await apiClient('/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({
          clientId: group.clientId,
          targetMonth: group.targetMonth,
          employeeIds: [...selected],
        }),
      });
      toast('請求書を発行しました');
      // 両方のデータを再取得
      fetchBillable();
      fetchInvoices();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '請求書の発行に失敗しました';
      toast(message);
    } finally {
      setGenerating(false);
    }
  }

  /* ── タブラベル ── */
  const tabLabels = ['請求発行', '発行済み一覧', '請求書プレビュー'] as const;

  return (
    <div>
      {/* ヘッダー */}
      <div data-print-hide className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">請求管理</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-outline text-sm py-2">一括PDF出力</button>
          <button onClick={() => setTab(0)} className="btn-primary text-sm py-2">請求書作成</button>
        </div>
      </div>

      {/* タブ */}
      <div data-print-hide className="flex gap-0 mb-5 border-b border-border">
        {tabLabels.map((label, idx) => (
          <button
            key={label}
            onClick={() => setTab(idx as 0 | 1 | 2)}
            className={`py-2.5 px-5 text-base border-b-2 -mb-px transition-colors
              ${tab === idx ? 'border-primary text-primary font-medium' : 'border-transparent text-secondary hover:text-primary'}`}
          >
            {label}
            {idx === 0 && billableGroups.length > 0 && (
              <span className="ml-1.5 bg-primary text-white text-xs rounded-full px-1.5 py-0.5">
                {billableGroups.reduce((s, g) => s + g.employeeCount, 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  Tab 0: 請求発行                                               */}
      {/* ============================================================ */}
      {tab === 0 && (
        <>
          {/* 月ナビゲーター */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button onClick={() => setMonthOffset(o => o - 1)} className="text-secondary hover:text-primary text-lg px-2">&lt;</button>
            <span className="text-base font-medium min-w-[120px] text-center">{monthLabel}</span>
            <button onClick={() => setMonthOffset(o => o + 1)} className="text-secondary hover:text-primary text-lg px-2">&gt;</button>
          </div>

          <p className="text-sm text-secondary mb-4">
            勤怠が確定済みで未請求の社員がクライアント別に表示されます。社員を選択して請求書を発行してください。
          </p>

          {billableLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : billableGroups.length === 0 ? (
            <div className="card p-10 text-center text-secondary">
              {monthLabel}に請求発行可能な確定済み勤怠はありません
            </div>
          ) : (
            <div className="space-y-3">
              {billableGroups.map((group) => {
                const isExpanded = expandedClients.has(group.clientId);
                const selected = selectedEmployees[group.clientId] || new Set();
                const allSelected = group.employees.every((e) => selected.has(e.employeeId));
                const selectedTotal = group.employees
                  .filter((e) => selected.has(e.employeeId))
                  .reduce((s, e) => s + e.subtotal, 0);

                return (
                  <div key={group.clientId} className="card overflow-hidden">
                    {/* クライアントヘッダー（アコーディオン） */}
                    <button
                      onClick={() => toggleExpand(group.clientId)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-page transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-secondary text-sm">{isExpanded ? '▼' : '▶'}</span>
                        <span className="text-base font-medium">{group.clientName}</span>
                        <span className="text-sm text-secondary">{group.targetMonth.replace('-', '年')}月</span>
                        <span className="badge badge-info">{group.employeeCount}名</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-secondary mr-2">合計(税抜)</span>
                        <span className="text-lg font-medium tabular-nums">{fmt(group.totalAmount)}</span>
                      </div>
                    </button>

                    {/* 社員一覧（展開時） */}
                    {isExpanded && (
                      <div className="border-t border-border px-5 pb-4">
                        {/* 全選択チェック */}
                        <div className="flex items-center gap-2 py-3 border-b border-border/30">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleAll(group.clientId, group.employees)}
                            className="w-4 h-4 rounded border-border accent-primary"
                          />
                          <span className="text-sm text-secondary">全選択</span>
                          {selected.size > 0 && selected.size < group.employees.length && (
                            <span className="text-xs text-secondary">（{selected.size}/{group.employees.length}名選択中）</span>
                          )}
                        </div>

                        {/* 社員リスト */}
                        {group.employees.map((emp) => {
                          const checked = selected.has(emp.employeeId);
                          const sl = settlementLabel(emp);
                          return (
                            <label
                              key={emp.employeeId}
                              className={`flex items-center gap-3 py-2.5 border-b border-border/10 cursor-pointer hover:bg-page transition-colors ${
                                !checked ? 'opacity-50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEmployee(group.clientId, emp.employeeId)}
                                className="w-4 h-4 rounded border-border accent-primary"
                              />
                              <span className="text-sm font-medium w-[100px] truncate">{emp.employeeName}</span>
                              <span className="text-xs text-secondary w-[120px] truncate">{emp.projectName}</span>
                              <span className="text-sm tabular-nums w-[70px] text-right">{emp.totalWorkHours}h</span>
                              <span className="text-xs text-secondary w-[90px] text-center">{emp.settlementLower}〜{emp.settlementUpper}h</span>
                              <span className="text-sm tabular-nums w-[100px] text-right">{fmt(emp.subtotal)}</span>
                              <span className={`text-xs w-[110px] text-right ${sl.cls}`}>{sl.text}</span>
                            </label>
                          );
                        })}

                        {/* 発行ボタン */}
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm text-secondary">
                            {selected.size > 0 && (
                              <>選択中: {selected.size}名 / 税抜合計: <span className="font-medium text-primary tabular-nums">{fmt(selectedTotal)}</span></>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerate(group)}
                            disabled={generating || selected.size === 0}
                            className={`btn-primary text-sm py-2 px-6 ${generating || selected.size === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            {generating ? '発行中...' : '選択した社員で請求書を発行'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  Tab 1: 発行済み一覧                                           */}
      {/* ============================================================ */}
      {tab === 1 && (
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
              <div className="text-2xl font-medium tabular-nums">{fmt(total)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary">入金済</div>
              <div className="text-2xl font-medium tabular-nums text-status-green-text">{fmt(paidTotal)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary">未入金</div>
              <div className="text-2xl font-medium tabular-nums">{fmt(unpaid)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary">入金遅延</div>
              <div className={`text-2xl font-medium tabular-nums ${overdueAmt > 0 ? 'text-status-red-text' : ''}`}>{fmt(overdueAmt)}</div>
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
                        <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(totalWithTax)}</td>
                        <td className="px-4 py-2.5 text-base text-right">{fmtDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-2.5 text-base text-right">{fmtDate(inv.dueDate)}</td>
                        <td className="px-4 py-2.5 text-base text-secondary">{inv.recipientEmail || '--'}</td>
                        <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => openPreview(inv)} className="btn-outline text-xs py-1 px-2">プレビュー</button>
                            <button onClick={() => openEdit(inv)} className="btn-outline text-xs py-1 px-2">編集</button>
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
      {/*  Tab 2: 請求書プレビュー                                       */}
      {/* ============================================================ */}
      {tab === 2 && (
        <>
          {/* アクション */}
          <div data-print-hide className="flex items-center gap-2 mb-4">
            <button onClick={() => { setTab(1); setEditing(false); setEditForm(null); }} className="btn-outline text-sm py-2">一覧に戻る</button>
            <div className="flex-1" />
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setEditForm(null); }} className="btn-outline text-sm py-2">キャンセル</button>
                <button onClick={handleSaveEdit} disabled={saving} className={`btn-primary text-sm py-2 ${saving ? 'opacity-50' : ''}`}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <>
                {selectedInvoice && (
                  <button onClick={() => openEdit(selectedInvoice)} className="btn-outline text-sm py-2">編集</button>
                )}
                <button onClick={() => window.print()} className="btn-outline text-sm py-2">PDF保存</button>
                <button onClick={() => toast('メール送信はfreee連携で対応予定です')} className="btn-primary text-sm py-2">メール送信</button>
              </>
            )}
          </div>

          {!selectedInvoice ? (
            <div data-print-hide className="card p-10 text-center text-secondary">
              請求書を選択してください
            </div>
          ) : (
          <div data-invoice-print-area className="card p-8 max-w-[820px] mx-auto">
            {/* ── タイトル ── */}
            <h2 className="text-2xl font-bold text-center mb-10" style={{ letterSpacing: '0.5em' }}>請 求 書</h2>

            {/* ── 上段: 宛先（左） ＋ 日付・番号（右） ── */}
            <div className="flex justify-between items-start mb-6">
              {/* 宛先 */}
              <div>
                <div className="flex items-baseline gap-6">
                  <span className="text-lg font-medium">{selectedInvoice.client.name}</span>
                  <span className="text-base">御中</span>
                </div>
              </div>
              {/* 日付・番号 */}
              <div className="text-sm">
                <table className="ml-auto">
                  <tbody>
                    <tr>
                      <td className="text-secondary pr-4 py-0.5">日付：</td>
                      <td className="text-right py-0.5">
                        {editing && editForm ? (
                          <input type="date" value={editForm.invoiceDate} onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm" />
                        ) : fmtDate(selectedInvoice.invoiceDate)}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-secondary pr-4 py-0.5">請求書番号：</td>
                      <td className="text-right py-0.5">{selectedInvoice.invoiceNo}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 中段: 挨拶+金額（左） ＋ 発行元情報（右） ── */}
            <div className="flex justify-between items-start mb-10">
              {/* 左: 挨拶 + ご請求金額 */}
              <div className="pt-1">
                <p className="text-sm mb-6">下記の通りご請求申し上げます。</p>
                <div>
                  <div className="flex items-baseline gap-6">
                    <span className="text-sm font-medium">ご請求金額</span>
                    <span className="text-2xl font-bold tabular-nums">{(() => {
                      if (!editing || !editForm) return fmt(selectedInvoice.totalAmount + selectedInvoice.tax);
                      const t = editForm.items.reduce((s, item) => {
                        let autoOt = 0, autoDed = 0;
                        if (item.settlementUpper > 0 && item.workHours > item.settlementUpper) autoOt = Math.round((item.workHours - item.settlementUpper) * (item.unitPrice / item.settlementUpper));
                        if (item.settlementLower > 0 && item.workHours < item.settlementLower) autoDed = Math.round((item.settlementLower - item.workHours) * (item.unitPrice / item.settlementLower));
                        const ot = (item.overtimeAmount !== undefined && item.overtimeAmount !== null) ? item.overtimeAmount : autoOt;
                        const ded = (item.deductionAmount !== undefined && item.deductionAmount !== null) ? item.deductionAmount : autoDed;
                        return s + item.unitPrice + ot - ded;
                      }, 0);
                      return fmt(t + Math.floor(t * 0.1));
                    })()}</span>
                  </div>
                  <div className="border-b-2 border-primary mt-1" />
                </div>
              </div>
              {/* 右: 発行元（自社）情報 + 角印 */}
              <div className="flex items-start gap-0">
                <div className="text-sm text-right leading-relaxed">
                  <div className="font-medium text-base mb-1">{issuer.name}</div>
                  <div className="text-secondary">{issuer.postalCode}</div>
                  <div className="text-secondary">{issuer.address1}</div>
                  <div className="text-secondary">{issuer.address2}</div>
                  <div className="text-secondary mt-1">登録番号：{issuer.registrationNo}</div>
                </div>
                {/* 角印 */}
                {issuer.sealImagePath ? (
                  <img src={issuer.sealImagePath} alt="角印" className="flex-shrink-0 w-[64px] h-[64px] object-contain ml-2 mt-0.5" />
                ) : (
                  <div className="flex-shrink-0 w-[64px] h-[64px] border-2 border-red-500/80 rounded-[2px] flex items-center justify-center ml-2 mt-0.5">
                    <span className="text-red-500/80 text-[11px] font-bold leading-[1.3] text-center" style={{ writingMode: 'vertical-rl' }}>
                      {issuer.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── 明細テーブル ── */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left text-xs text-secondary font-normal px-3 py-2">技術者名</th>
                    <th className="text-left text-xs text-secondary font-normal px-3 py-2">業務内容</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">稼働時間</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">精算幅</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">単価（税抜）</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">超過/控除</th>
                    <th className="text-right text-xs text-secondary font-normal px-3 py-2">金額（税抜）</th>
                    {editing && <th className="w-[40px]" />}
                  </tr>
                </thead>
                <tbody>
                  {(editing && editForm ? editForm.items : selectedInvoice.items).map((row, lineIdx) => {
                    const isEdit = editing && editForm;
                    const item = isEdit ? editForm.items[lineIdx] : null;
                    const line = !isEdit ? (selectedInvoice.items[lineIdx] || null) : null;

                    const wh = item ? item.workHours : Number(line?.workHours || 0);
                    const price = item ? item.unitPrice : (line?.unitPrice || 0);
                    const lower = item ? item.settlementLower : (line?.settlementLower || 0);
                    const upper = item ? item.settlementUpper : (line?.settlementUpper || 0);
                    const empName = item ? item.employeeName : (line?.employeeName || '');
                    const desc = item ? item.description : (line?.description || '');

                    // 自動計算
                    let autoOvertime = 0;
                    let autoDeduction = 0;
                    if (upper > 0 && wh > upper) autoOvertime = Math.round((wh - upper) * (price / upper));
                    if (lower > 0 && wh < lower) autoDeduction = Math.round((lower - wh) * (price / lower));
                    // 手動値があればそちらを優先
                    const overtimeAmt = (item?.overtimeAmount !== undefined && item?.overtimeAmount !== null) ? item.overtimeAmount : autoOvertime;
                    const deductionAmt = (item?.deductionAmount !== undefined && item?.deductionAmount !== null) ? item.deductionAmount : autoDeduction;
                    // 閲覧モード時はDB値を使用
                    const dispOvertime = isEdit ? overtimeAmt : (line?.overtimeAmount || 0);
                    const dispDeduction = isEdit ? deductionAmt : (line?.deductionAmount || 0);
                    const subtotal = price + dispOvertime - dispDeduction;
                    const hasOvertime = dispOvertime > 0;
                    const hasDeduction = dispDeduction > 0;
                    const overtimeHours = hasOvertime && upper > 0 ? Math.round((wh - upper) * 10) / 10 : 0;
                    const overtimeRate = hasOvertime && upper > 0 ? Math.round(price / upper) : 0;
                    const deductionHours = hasDeduction && lower > 0 ? Math.round((lower - wh) * 10) / 10 : 0;
                    const deductionRate = hasDeduction && lower > 0 ? Math.round(price / lower) : 0;

                    const inputCls = "border border-border rounded px-2 py-1 text-sm text-right w-[90px] tabular-nums";

                    return (
                      <React.Fragment key={item ? `edit-${lineIdx}` : (line?.id || lineIdx)}>
                        <tr className={hasOvertime || hasDeduction ? '' : 'border-b border-border/30'}>
                          <td className="px-3 py-2.5 text-sm font-medium">
                            {item ? (
                              <input value={item.employeeName} onChange={(e) => updateEditItem(lineIdx, 'employeeName', e.target.value)} className="border border-border rounded px-2 py-1 text-sm w-full" placeholder="技術者名" />
                            ) : empName}
                          </td>
                          <td className="px-3 py-2.5 text-sm">
                            {item ? (
                              <input value={item.description} onChange={(e) => updateEditItem(lineIdx, 'description', e.target.value)} className="border border-border rounded px-2 py-1 text-sm w-full" placeholder="業務内容" />
                            ) : desc}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-right">
                            {item ? (
                              <input type="number" step="0.5" value={item.workHours} onChange={(e) => updateEditItem(lineIdx, 'workHours', Number(e.target.value))} className={inputCls} />
                            ) : <>{wh}h</>}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-right">
                            {item ? (
                              <span className="flex items-center justify-end gap-0.5">
                                <input type="number" value={item.settlementLower} onChange={(e) => updateEditItem(lineIdx, 'settlementLower', Number(e.target.value))} className="border border-border rounded px-1 py-1 text-sm text-right w-[50px]" />
                                <span className="text-xs text-secondary">〜</span>
                                <input type="number" value={item.settlementUpper} onChange={(e) => updateEditItem(lineIdx, 'settlementUpper', Number(e.target.value))} className="border border-border rounded px-1 py-1 text-sm text-right w-[50px]" />
                              </span>
                            ) : (lower && upper ? `${lower}〜${upper}h` : '--')}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-right tabular-nums">
                            {item ? (
                              <input type="number" value={item.unitPrice} onChange={(e) => updateEditItem(lineIdx, 'unitPrice', Number(e.target.value))} className={inputCls} />
                            ) : fmt(price)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-right tabular-nums">
                            {item ? (
                              <div className="flex flex-col gap-1 items-end">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-secondary">超過</span>
                                  <input type="number" value={item.overtimeAmount ?? autoOvertime} onChange={(e) => updateEditItem(lineIdx, 'overtimeAmount', Number(e.target.value))} className="border border-border rounded px-1 py-0.5 text-xs text-right w-[80px] tabular-nums" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-status-red-text">控除</span>
                                  <input type="number" value={item.deductionAmount ?? autoDeduction} onChange={(e) => updateEditItem(lineIdx, 'deductionAmount', Number(e.target.value))} className="border border-border rounded px-1 py-0.5 text-xs text-right w-[80px] tabular-nums" />
                                </div>
                              </div>
                            ) : (
                              <>
                                {hasOvertime && <span>{fmt(dispOvertime)}</span>}
                                {hasDeduction && <span className="text-status-red-text">-{fmt(dispDeduction)}</span>}
                                {!hasOvertime && !hasDeduction && '--'}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-right tabular-nums font-medium">{fmt(subtotal)}</td>
                          {editing && (
                            <td className="px-1 py-2.5 text-center">
                              <button onClick={() => removeEditItem(lineIdx)} className="text-secondary hover:text-status-red-text text-sm" title="削除">×</button>
                            </td>
                          )}
                        </tr>
                        {hasDeduction && (
                          <tr className="border-b border-border/30">
                            <td />
                            <td />
                            <td colSpan={editing ? 6 : 5} className="px-3 pb-2.5 text-xs text-secondary tabular-nums text-left">
                              └ 控除分　{deductionHours}h × {deductionRate.toLocaleString()}円 ＝ {fmt(dispDeduction)}
                            </td>
                          </tr>
                        )}
                        {hasOvertime && (
                          <tr className="border-b border-border/30">
                            <td />
                            <td />
                            <td colSpan={editing ? 6 : 5} className="px-3 pb-2.5 text-xs text-secondary tabular-nums text-left">
                              └ 超過分　{overtimeHours}h × {overtimeRate.toLocaleString()}円 ＝ {fmt(dispOvertime)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {/* 明細追加ボタン（編集時のみ） */}
              {editing && (
                <button onClick={addEditItem} className="mt-2 text-sm text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5">
                  <span className="text-lg leading-none">＋</span> 明細を追加
                </button>
              )}
            </div>

            {/* ── 税率区分合計 ── */}
            {(() => {
              // 編集中はリアルタイム計算
              let dispTotal = selectedInvoice.totalAmount;
              let dispTax = selectedInvoice.tax;
              if (editing && editForm) {
                dispTotal = editForm.items.reduce((s, item) => {
                  const wh = item.workHours;
                  const lo = item.settlementLower;
                  const up = item.settlementUpper;
                  let autoOt = 0, autoDed = 0;
                  if (up > 0 && wh > up) autoOt = Math.round((wh - up) * (item.unitPrice / up));
                  if (lo > 0 && wh < lo) autoDed = Math.round((lo - wh) * (item.unitPrice / lo));
                  const ot = (item.overtimeAmount !== undefined && item.overtimeAmount !== null) ? item.overtimeAmount : autoOt;
                  const ded = (item.deductionAmount !== undefined && item.deductionAmount !== null) ? item.deductionAmount : autoDed;
                  return s + item.unitPrice + ot - ded;
                }, 0);
                dispTax = Math.floor(dispTotal * 0.1);
              }
              return (
                <div className="flex justify-end mb-8">
                  <div className="w-full max-w-[380px] space-y-0">
                    <div className="flex justify-between py-1.5 border-b border-border/20 text-sm">
                      <span className="text-secondary">10%対象 税抜金額</span>
                      <span className="tabular-nums">{fmt(dispTotal)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20 text-sm">
                      <span className="text-secondary">消費税額（10%）</span>
                      <span className="tabular-nums">{fmt(dispTax)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b-2 border-border text-base font-medium">
                      <span>合計（税込）</span>
                      <span className="tabular-nums">{fmt(dispTotal + dispTax)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── 振込先 ── */}
            <div className="mb-6 text-sm leading-relaxed">
              <div>振込期日：{editing && editForm ? (
                <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm" />
              ) : fmtDate(selectedInvoice.dueDate)}</div>
              {editing && editForm ? (
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  <input value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm w-[120px]" placeholder="銀行名" />
                  <input value={editForm.bankBranch} onChange={(e) => setEditForm({ ...editForm, bankBranch: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm w-[100px]" placeholder="支店名" />
                  <input value={editForm.bankAccountType} onChange={(e) => setEditForm({ ...editForm, bankAccountType: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm w-[60px]" placeholder="種別" />
                  <input value={editForm.bankAccountNumber} onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm w-[100px]" placeholder="口座番号" />
                  <div className="w-full mt-0.5">
                    <input value={editForm.bankAccountHolder} onChange={(e) => setEditForm({ ...editForm, bankAccountHolder: e.target.value })} className="border border-border rounded px-2 py-0.5 text-sm w-[200px]" placeholder="口座名義" />
                  </div>
                </div>
              ) : (
                <>
                  <div>{issuer.bankName} {issuer.bankBranch}　{issuer.bankAccountType}　{issuer.bankAccountNumber}</div>
                  <div>{issuer.bankAccountHolder}</div>
                </>
              )}
            </div>

            {/* ── 備考 ── */}
            <div className="border border-border rounded p-4 text-sm">
              <div className="font-medium mb-2">備考：</div>
              {editing && editForm ? (
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="備考を入力" />
              ) : (
                <div className="text-secondary leading-relaxed">
                  {selectedInvoice.notes && <>{selectedInvoice.notes}<br /></>}
                  恐れ入りますが、振込手数料は貴社にてご負担願います。
                </div>
              )}
            </div>
          </div>
          )}
        </>
      )}

      <ToastUI />
    </div>
  );
}
