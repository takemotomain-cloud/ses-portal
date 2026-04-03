/**
 * 管理側 給与管理
 *
 * UIモックのpage-payrollを再現。
 * ステップバー（勤怠締め→計算→確認→確定→振込）+ 社員テーブル + 詳細パネル。
 */

'use client';

import { useState } from 'react';

const steps = ['勤怠締め', '給与計算', '明細確認', '給与確定', '振込'];
const currentStepIdx = 2; // 明細確認フェーズ（デモ）

const demoPayroll: { id: string; code: string; name: string; base: number; ot: number; commute: number; gross: number; deductions: number; net: number; status: string }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '未確認', cls: 'badge-wait' },
  confirmed: { label: '確認済', cls: 'badge-ok' },
  paid: { label: '振込済', cls: 'badge-info' },
};

export default function AdminPayrollPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? demoPayroll.find(p => p.id === selectedId) : null;

  const totalNet = demoPayroll.reduce((s, p) => s + p.net, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">給与管理</h1>
        <div className="text-sm text-secondary">2026年3月分</div>
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

      {/* サマリー */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">対象社員</div>
          <div className="text-3xl font-medium">{demoPayroll.length}<span className="text-base font-normal text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">総支給額合計</div>
          <div className="text-2xl font-medium tabular-nums">{fmt(demoPayroll.reduce((s, p) => s + p.gross, 0))}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">差引支給額合計</div>
          <div className="text-2xl font-medium tabular-nums">{fmt(totalNet)}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">未確認</div>
          <div className="text-3xl font-medium text-status-amber-text">{demoPayroll.filter(p => p.status === 'draft').length}<span className="text-base font-normal ml-1">名</span></div>
        </div>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[750px]">
          <thead>
            <tr className="border-b border-border">
              {['社員番号', '氏名', '基本給', '残業手当', '総支給額', '控除合計', '差引支給額', 'ステータス'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demoPayroll.length === 0 ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoPayroll.map(p => {
              const st = statusBadge[p.status];
              return (
                <tr key={p.id} onClick={() => setSelectedId(p.id)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-base text-secondary">{p.code}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.base)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.ot)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums font-medium">{fmt(p.gross)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.deductions)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums font-medium">{fmt(p.net)}</td>
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
              <div className="text-xl font-medium">{selected.name}</div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">支給</div>
                {[['基本給', selected.base], ['残業手当', selected.ot], ['通勤手当', selected.commute]].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span className="tabular-nums">{fmt(v as number)}円</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">控除</div>
                <div className="flex justify-between py-1.5 border-b border-border/20 text-base">
                  <span className="text-secondary">控除合計</span><span className="tabular-nums">{fmt(selected.deductions)}円</span>
                </div>
              </div>
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">差引支給額</div>
                <div className="text-2xl font-medium tabular-nums">{fmt(selected.net)}円</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-outline flex-1 text-sm py-2">PDF出力</button>
                <button className="btn-outline flex-1 text-sm py-2">修正</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
