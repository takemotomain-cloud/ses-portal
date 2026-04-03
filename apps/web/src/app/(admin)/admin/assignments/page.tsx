/**
 * 管理側 稼働管理
 *
 * UIモックのpage-assignmentsを再現。
 * エリア別KPIカード + フィルタ + アサインテーブル。
 * 契約終了日が30日以内=アンバー、7日以内=赤で行を警告。
 * 行クリック→詳細パネル。
 */

'use client';

import { useState, useMemo } from 'react';

const demoAssignments: { id: string; name: string; client: string; project: string; price: number; lower: number; upper: number; start: string; end: string; status: string; area: string }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

function daysUntil(dateStr: string): number {
  if (!dateStr) return 9999;
  const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!match) return 9999;
  const target = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  return Math.ceil((target.getTime() - new Date().getTime()) / 86400000);
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: '稼働中', cls: 'badge-ok' },
  next_confirmed: { label: '次案件確定', cls: 'badge-info' },
  ended: { label: '終了済', cls: 'badge-wait' },
  standby: { label: '待機', cls: 'badge-warn' },
};

export default function AdminAssignmentsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return demoAssignments.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (clientFilter && a.client !== clientFilter) return false;
      if (search && !a.name.includes(search)) return false;
      return true;
    }).sort((a, b) => {
      if (a.status === 'standby') return 1;
      if (b.status === 'standby') return -1;
      return daysUntil(a.end) - daysUntil(b.end);
    });
  }, [statusFilter, clientFilter, search]);

  const selected = selectedId ? demoAssignments.find(a => a.id === selectedId) : null;

  // エリア別KPI
  const areaKpis = useMemo(() => {
    const areas = ['東京', '大阪', '名古屋'];
    return areas.map(area => {
      const inArea = demoAssignments.filter(a => a.area === area);
      const active = inArea.filter(a => a.status === 'active').length;
      const total = inArea.length;
      const ending = inArea.filter(a => a.status === 'active' && daysUntil(a.end) <= 30).length;
      return { area, active, total, rate: total ? Math.round(active / total * 100) : 0, ending };
    });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">稼働管理</h1>
        <button className="btn-primary text-sm py-2">新規アサイン登録</button>
      </div>

      {/* エリア別KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {areaKpis.map(kpi => (
          <div key={kpi.area} className="card p-4">
            <div className="text-xs text-secondary mb-1">{kpi.area}エリア</div>
            <div className="flex items-end gap-3">
              <div className="text-2xl font-medium">{kpi.rate}<span className="text-sm font-normal text-secondary">%</span></div>
              <div className="text-sm text-secondary">{kpi.active}名 / {kpi.total}名</div>
            </div>
            {kpi.ending > 0 && (
              <div className="text-xs text-status-amber-text mt-1">契約終了30日以内: {kpi.ending}名</div>
            )}
          </div>
        ))}
      </div>

      {/* フィルタ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
          <option value="">ステータス: すべて</option>
          <option value="active">稼働中</option>
          <option value="next_confirmed">次案件確定</option>
          <option value="ended">終了済</option>
          <option value="standby">待機</option>
        </select>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
          <option value="">クライアント: すべて</option>
        </select>
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[160px] focus:border-primary" />
        <span className="text-sm text-secondary self-center">{filtered.length}件</span>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['氏名', 'クライアント / 案件', '契約単価', '精算幅', '契約開始日', '契約終了日', 'アサイン状態'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map(a => {
              const days = daysUntil(a.end);
              const st = statusBadge[a.status];
              const rowBg = a.status === 'active' && days <= 7 ? 'bg-status-red-bg/40' : a.status === 'active' && days <= 30 ? 'bg-status-amber-bg/40' : '';
              return (
                <tr key={a.id} onClick={() => setSelectedId(a.id)} className={`border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors ${rowBg}`}>
                  <td className="px-4 py-2.5 text-base font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-base">{a.client ? `${a.client} / ${a.project}` : <span className="text-secondary italic">未アサイン</span>}</td>
                  <td className="px-4 py-2.5 text-base tabular-nums text-right">{a.price ? fmt(a.price) + '円' : '--'}</td>
                  <td className="px-4 py-2.5 text-base text-right">{a.lower ? `${a.lower}〜${a.upper}h` : '--'}</td>
                  <td className="px-4 py-2.5 text-base text-right">{a.start || '--'}</td>
                  <td className="px-4 py-2.5 text-base text-right">{a.end || '--'}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 詳細パネル */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.client || '待機中'}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">現在の稼働</div>
                {selected.client ? (
                  <>
                    {[
                      ['案件名', selected.project],
                      ['契約単価', fmt(selected.price) + '円'],
                      ['精算幅', `${selected.lower}〜${selected.upper}h`],
                      ['契約期間', `${selected.start} 〜 ${selected.end}`],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                        <span className="text-secondary">{l}</span><span>{v}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-base text-secondary italic">待機中</div>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-outline flex-1 text-sm py-2">契約延長</button>
                <button className="btn-outline flex-1 text-sm py-2 text-status-red-text border-status-red-text/30 hover:bg-status-red-bg">稼働終了</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
