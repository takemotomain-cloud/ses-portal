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
  status: 'proposing' | 'interview' | 'waiting' | 'confirmed';
  interviewDate?: string;
}

interface Engineer {
  id: string;
  name: string;
  status: 'proposing' | 'confirmed' | 'undecided';
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

  const kpis = {
    proposing: engineers.filter(e => e.status === 'proposing').length,
    confirmed: engineers.filter(e => e.status === 'confirmed').length,
    undecided: engineers.filter(e => e.status === 'undecided').length,
  };

  const filtered = engineers.filter(e => !search || e.name.includes(search));

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
      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[160px] focus:border-primary" />
      </div>

      {/* エンジニアカード */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card px-4 py-8 text-center text-sm text-secondary">データはありません</div>
        )}
        {filtered.map(eng => (
          <div key={eng.id} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-lg font-medium">{eng.name}</div>
                {eng.endDate && <div className="text-sm text-status-amber-text mt-0.5">契約終了: {eng.endDate}</div>}
              </div>
              <span className={`badge ${eng.status === 'confirmed' ? 'badge-ok' : eng.status === 'proposing' ? 'badge-info' : 'badge-warn'}`}>
                {eng.status === 'confirmed' ? '案件確定' : eng.status === 'proposing' ? '営業中' : '未決定'}
              </span>
            </div>

            {/* 提案一覧 */}
            <div className="space-y-2">
              {eng.proposals.map((prop, idx) => {
                const st = statusLabels[prop.status];
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-page rounded-lg gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-medium">{prop.client}</span>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {prop.interviewDate && <span className="text-secondary">面談: {prop.interviewDate}</span>}
                      <select className="border border-border rounded px-2 py-1 text-sm bg-card outline-none appearance-none" defaultValue={prop.status}>
                        <option value="proposing">提案中</option>
                        <option value="interview">面談予定</option>
                        <option value="waiting">結果待ち</option>
                        <option value="confirmed">確定</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="mt-3 text-sm text-secondary hover:text-primary transition-colors">＋ 提案先を追加</button>
          </div>
        ))}
      </div>
    </div>
  );
}
