/**
 * 候補者一覧
 *
 * 検索・フィルタ付きテーブル + 行クリックで詳細パネル。
 * ステータス: 応募→書類選考→面接→内定出し→内定承諾→入社。
 */

'use client';

import { useState, useMemo } from 'react';

const demoCandidates: { id: string; name: string; kana: string; source: string; position: string; status: string; applyDate: string; lastUpdate: string }[] = [];

const statusConfig: Record<string, { label: string; cls: string }> = {
  applied: { label: '応募', cls: 'badge-info' },
  screening: { label: '書類選考', cls: 'badge-warn' },
  interview: { label: '面接', cls: 'badge-warn' },
  offer: { label: '内定出し', cls: 'badge-ok' },
  offer_accepted: { label: '内定承諾', cls: 'badge-ok' },
  hired: { label: '入社', cls: 'badge-ok' },
  rejected: { label: '不採用', cls: 'badge-danger' },
  withdrawn: { label: '辞退', cls: 'badge-wait' },
};

export default function RecruitCandidatesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return demoCandidates.filter(c => {
      if (search && !c.name.includes(search) && !c.kana.includes(search)) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    });
  }, [search, statusFilter]);

  const selected = selectedId ? demoCandidates.find(c => c.id === selectedId) : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">候補者一覧</h1>
        <button className="btn-primary text-sm py-2">候補者登録</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[160px]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
          <option value="">ステータス: すべて</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-sm text-secondary self-center">{filtered.length}名</span>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr className="border-b border-border">
            {['氏名', '応募経路', '応募職種', 'ステータス', '応募日', '最終更新'].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map(c => {
              const st = statusConfig[c.status];
              return (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer">
                  <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-base">{c.source}</td>
                  <td className="px-4 py-2.5 text-base">{c.position}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5 text-base text-secondary">{c.applyDate}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{c.lastUpdate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary">{selected.kana}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">応募情報</div>
                {[['応募経路', selected.source], ['応募職種', selected.position], ['応募日', selected.applyDate]].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn-outline flex-1 text-sm py-2">編集</button>
                <button className="btn-primary flex-1 text-sm py-2">ステータス更新</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
