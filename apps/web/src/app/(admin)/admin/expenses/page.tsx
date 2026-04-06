/**
 * 管理側 経費精算
 *
 * 全社員の交通費・経費一覧。月切替 + KPI + ステータスフィルタ + 承認操作。
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface ExpenseItem {
  expenseDate: string;
  departure: string;
  destination: string;
  amount: number;
  sortOrder: number;
}

interface ExpenseResponse {
  id: string;
  employeeId: string;
  targetMonth: string;
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
  items: ExpenseItem[];
}

interface MappedExpense {
  name: string;
  type: string;
  desc: string;
  count: number;
  amount: number;
  date: string;
  status: string;
}

function mapStatus(s: string): string {
  if (s === 'approved') return 'ok';
  if (s === 'rejected') return 'rejected';
  return 'pending';
}

function formatJapaneseDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function mapExpense(e: ExpenseResponse): MappedExpense {
  const desc = e.items.length > 0
    ? `${e.items[0].departure} → ${e.items[0].destination}`
    : '—';
  return {
    name: `${e.employee.lastName} ${e.employee.firstName}`,
    type: '交通費',
    desc,
    count: e.items.length,
    amount: e.totalAmount,
    date: formatJapaneseDate(e.createdAt),
    status: mapStatus(e.status),
  };
}

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: '承認待ち', cls: 'badge-warn' },
  ok: { label: '承認済', cls: 'badge-ok' },
  rejected: { label: '却下', cls: 'badge-danger' },
};

export default function AdminExpensesPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);
  const [filter, setFilter] = useState('');
  const [expenses, setExpenses] = useState<MappedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, ToastUI } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient<ExpenseResponse[]>('/expense/pending')
      .then((data) => {
        if (!cancelled) {
          setExpenses(data.map(mapExpense));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExpenses([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  const handleCsvExport = useCallback(() => {
    const headers = ['申請者', '申請日', '種別', '金額', 'ステータス'];
    const rows = (filter ? expenses.filter(e => e.status === filter) : expenses).map(e => {
      const st = statusBadge[e.status];
      return [e.name, e.date, e.type, String(e.amount), st?.label ?? e.status];
    });
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `経費_${year}年${month}月.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSVをダウンロードしました');
  }, [year, month, filter, toast, expenses]);

  const filtered = filter ? expenses.filter(e => e.status === filter) : expenses;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter(e => e.status === 'pending').length;
  const approved = expenses.filter(e => e.status === 'ok').length;
  const rejected = expenses.filter(e => e.status === 'rejected').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">経費精算</h1>
        <button onClick={handleCsvExport} className="btn-outline text-sm py-1.5">CSVエクスポート</button>
      </div>

      {/* 月切り替え */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => changeMonth(-1)} className="btn-outline py-1 px-3 text-sm">&lt;</button>
        <span className="text-lg font-medium min-w-[100px] text-center">{year}年{month}月</span>
        <button onClick={() => changeMonth(1)} className="btn-outline py-1 px-3 text-sm">&gt;</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">経費合計</div>
          <div className="text-2xl font-medium tabular-nums">{fmt(total)}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">承認待ち</div>
          <div className="text-3xl font-medium text-status-amber-text">{pending}<span className="text-base font-normal ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">承認済</div>
          <div className="text-3xl font-medium">{approved}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">却下</div>
          <div className="text-3xl font-medium">{rejected}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
      </div>

      {/* ステータスフィルタ */}
      <div className="flex gap-2 mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
          <option value="">ステータス: すべて</option>
          <option value="pending">承認待ち</option>
          <option value="ok">承認済</option>
          <option value="rejected">却下</option>
        </select>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="border-b border-border">
            {['申請者', '種別', '内容', '件数', '合計金額', '申請日', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map((e, idx) => {
              const st = statusBadge[e.status];
              return (
                <tr key={idx} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 text-base">{e.type}</td>
                  <td className="px-4 py-2.5 text-base">{e.desc}</td>
                  <td className="px-4 py-2.5 text-base text-right">{e.count}件</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(e.amount)}円</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{e.date}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ToastUI />
    </div>
  );
}
