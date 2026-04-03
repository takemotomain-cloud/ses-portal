/**
 * 管理側 請求管理
 *
 * 月切替 + 請求書一覧 + プレビュー。
 * SES特有の明細（社員名・単価・精算幅・実績時間）を含む請求書を自社生成。
 */

'use client';

import { useState } from 'react';

const demoInvoices: { client: string; amount: number; members: number; status: string; date: string }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '下書き', cls: 'badge-wait' },
  sent: { label: '送付済', cls: 'badge-info' },
  paid: { label: '入金済', cls: 'badge-ok' },
  overdue: { label: '未入金', cls: 'badge-danger' },
};

export default function AdminBillingPage() {
  const total = demoInvoices.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">請求管理</h1>
        <div className="text-sm text-secondary">2026年3月分</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4"><div className="text-xs text-secondary">請求総額</div><div className="text-2xl font-medium tabular-nums">{fmt(total)}<span className="text-sm font-normal text-secondary ml-1">円</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">送付済</div><div className="text-3xl font-medium">{demoInvoices.filter(i => i.status === 'sent').length}<span className="text-base font-normal text-secondary ml-1">件</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">入金済</div><div className="text-3xl font-medium text-status-green-text">{demoInvoices.filter(i => i.status === 'paid').length}<span className="text-base font-normal ml-1">件</span></div></div>
        <div className="card p-4"><div className="text-xs text-secondary">下書き</div><div className="text-3xl font-medium text-status-amber-text">{demoInvoices.filter(i => i.status === 'draft').length}<span className="text-base font-normal ml-1">件</span></div></div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[550px]">
          <thead><tr className="border-b border-border">
            {['クライアント', '請求額', '人数', '送付日', 'ステータス', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {demoInvoices.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoInvoices.map((inv, idx) => {
              const st = statusBadge[inv.status];
              return (
                <tr key={idx} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer">
                  <td className="px-4 py-2.5 text-base font-medium">{inv.client}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(inv.amount)}円</td>
                  <td className="px-4 py-2.5 text-base text-right">{inv.members}名</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{inv.date || '--'}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button className="btn-outline text-xs py-1 px-2">プレビュー</button>
                      {inv.status === 'draft' && <button className="bg-status-green-text text-white text-xs py-1 px-2.5 rounded-md hover:opacity-85">PDF送信</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
