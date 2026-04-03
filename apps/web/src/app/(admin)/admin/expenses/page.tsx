/**
 * 管理側 経費精算
 *
 * 全社員の交通費・経費一覧。月切替 + ステータスフィルタ + 承認操作。
 */

'use client';

import { useState } from 'react';

const demoExpenses: { name: string; type: string; desc: string; count: number; amount: number; date: string; status: string }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: '承認待ち', cls: 'badge-warn' },
  ok: { label: '承認済', cls: 'badge-ok' },
  rejected: { label: '却下', cls: 'badge-danger' },
};

export default function AdminExpensesPage() {
  const [filter, setFilter] = useState('');
  const filtered = filter ? demoExpenses.filter(e => e.status === filter) : demoExpenses;
  const total = demoExpenses.reduce((s, e) => s + e.amount, 0);
  const pending = demoExpenses.filter(e => e.status === 'pending').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">経費精算</h1>
        <button className="btn-outline text-sm py-2">CSVエクスポート</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4"><div className="text-xs text-secondary">経費合計</div><div className="text-2xl font-medium tabular-nums">{fmt(total)}<span className="text-sm font-normal text-secondary ml-1">円</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">承認待ち</div><div className="text-3xl font-medium text-status-amber-text">{pending}<span className="text-base font-normal ml-1">件</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">承認済</div><div className="text-3xl font-medium">{demoExpenses.filter(e => e.status === 'ok').length}<span className="text-base font-normal text-secondary ml-1">件</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">却下</div><div className="text-3xl font-medium">0<span className="text-base font-normal text-secondary ml-1">件</span></div></div>
      </div>

      <div className="flex gap-2 mb-4">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
          <option value="">ステータス: すべて</option>
          <option value="pending">承認待ち</option>
          <option value="ok">承認済</option>
          <option value="rejected">却下</option>
        </select>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="border-b border-border">
            {['申請者', '種別', '内容', '件数', '合計金額', '申請日', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
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
    </div>
  );
}
