/**
 * 管理側 営業管理
 *
 * UIモックのpage-sales-pipelineを再現。
 * エンジニアごとのカード形式UI。KPI3枚（営業中/案件確定/未決定）。
 * 各エンジニアに提案先を複数登録、面談日程管理、確定→稼働管理連動。
 */

'use client';

import { useState } from 'react';

interface Proposal {
  client: string;
  project?: string;
  status: 'proposing' | 'interview' | 'waiting' | 'confirmed';
  interviewDate?: string;
}

interface Engineer {
  id: string;
  name: string;
  code?: string;
  status: 'proposing' | 'confirmed' | 'undecided';
  currentClient?: string;
  currentProject?: string;
  endDate?: string;
  proposals: Proposal[];
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  proposing: { label: '提案中', cls: 'badge-info' },
  interview: { label: '面談予定', cls: 'badge-warn' },
  waiting: { label: '結果待ち', cls: 'badge-wait' },
  confirmed: { label: '確定', cls: 'badge-ok' },
};

const initialEngineers: Engineer[] = [];

export default function AdminSalesPage() {
  const [engineers, setEngineers] = useState(initialEngineers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const kpis = {
    proposing: engineers.filter(e => e.status === 'proposing').length,
    confirmed: engineers.filter(e => e.status === 'confirmed').length,
    undecided: engineers.filter(e => e.status === 'undecided').length,
  };

  const filtered = engineers.filter(e => {
    if (search && !e.name.includes(search)) return false;
    if (statusFilter) {
      const hasMatch = e.proposals.some(p => p.status === statusFilter);
      if (!hasMatch) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">営業管理</h1>
        <button className="btn-outline text-sm py-2">エンジニアを追加</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">営業中</div>
          <div className="text-3xl font-medium text-status-blue-text">{kpis.proposing}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">案件確定</div>
          <div className="text-3xl font-medium text-status-green-text">{kpis.confirmed}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">未決定</div>
          <div className="text-3xl font-medium text-status-amber-text">{kpis.undecided}<span className="text-base font-normal ml-1">名</span></div>
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none min-w-[160px]">
          <option value="">ステータス: すべて</option>
          <option value="proposing">提案中</option>
          <option value="interview">面談予定</option>
          <option value="waiting">結果待ち</option>
          <option value="confirmed">確定</option>
        </select>
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[160px] focus:border-primary" />
        <span className="text-xs text-secondary ml-1">{filtered.length}名 表示中</span>
      </div>

      {/* エンジニアカード */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card px-4 py-8 text-center text-sm text-secondary">データはありません</div>
        )}
        {filtered.map(eng => {
          const isExpanded = expandedIds.has(eng.id);
          return (
          <div key={eng.id} className="card p-5">
            {/* エンジニアヘッダー行 */}
            <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => toggleExpand(eng.id)}>
              <span className="text-xs text-secondary select-none">{isExpanded ? '▼' : '▶'}</span>
              <span className={`badge ${eng.status === 'confirmed' ? 'badge-ok' : eng.status === 'proposing' ? 'badge-info' : 'badge-warn'}`}>
                {eng.status === 'confirmed' ? '案件確定' : eng.status === 'proposing' ? '営業中' : '未決定'}
              </span>
              <span className="text-[15px] font-medium">{eng.name}</span>
              {eng.code && <span className="text-xs text-secondary">{eng.code}</span>}
              <div className="ml-auto flex gap-4 text-[13px] text-secondary">
                <span>{eng.currentClient ? `${eng.currentClient} / ${eng.currentProject ?? ''}` : '未稼働'}</span>
                {eng.endDate && <span className="text-status-amber-text">終了: {eng.endDate}</span>}
              </div>
            </div>

            {/* 提案一覧（展開時） */}
            {isExpanded && (
              <>
                {eng.proposals.length > 0 && (
                  <div className="border-t border-border/30 mt-3 pt-2.5">
                    {eng.proposals.map((prop, idx) => {
                      const st = statusLabels[prop.status];
                      return (
                        <div key={idx} className="flex items-center gap-2.5 py-1.5 border-b border-border/20 flex-wrap">
                          <div className="min-w-[180px]">
                            <div className="text-[13px] font-medium">{prop.client}</div>
                            {prop.project && <div className="text-xs text-secondary">{prop.project}</div>}
                          </div>
                          {prop.interviewDate && (
                            <span className="text-xs text-secondary">面談: {prop.interviewDate}</span>
                          )}
                          <select className="border border-border rounded px-2 py-1 text-xs bg-card outline-none appearance-none" defaultValue={prop.status}>
                            <option value="proposing">提案中</option>
                            <option value="interview">面談予定</option>
                            <option value="waiting">結果待ち</option>
                            <option value="confirmed">確定</option>
                          </select>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2">
                  <button className="btn-outline text-[11px] py-0.5 px-2.5">＋ 提案を追加</button>
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
