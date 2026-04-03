/**
 * 管理側 契約書
 *
 * テーブル一覧 + クラウドサインAPI連携ステータス。
 * 基本契約/個別契約/NDA/覚書の管理。
 */

'use client';

import { useState } from 'react';

const demoContracts: { name: string; company: string; type: string; status: string; period: string; updated: string }[] = [];

const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '下書き', cls: 'badge-wait' },
  sent: { label: '送信済', cls: 'badge-warn' },
  signed: { label: '締結済', cls: 'badge-ok' },
  expired: { label: '期限切れ', cls: 'badge-danger' },
};

export default function AdminContractsPage() {
  const [search, setSearch] = useState('');
  const filtered = demoContracts.filter(c => !search || c.name.includes(search) || c.company.includes(search));

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">契約書</h1>
        <button className="btn-primary text-sm py-2">新規作成</button>
      </div>

      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="契約名・会社名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[200px]" />
        <span className="text-sm text-secondary self-center">{filtered.length}件</span>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr className="border-b border-border">
            {['契約名', '取引先', '種別', 'ステータス', '契約期間', '更新日'].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map((c, idx) => {
              const st = statusBadge[c.status];
              return (
                <tr key={idx} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer">
                  <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-base">{c.company}</td>
                  <td className="px-4 py-2.5 text-base">{c.type}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5 text-base text-secondary text-right">{c.period}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{c.updated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-secondary">
        クラウドサインAPI連携：契約書の送信・署名依頼・ステータス同期・締結済みPDFの自動保管に対応
      </div>
    </div>
  );
}
