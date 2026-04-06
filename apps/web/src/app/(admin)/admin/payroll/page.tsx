/**
 * 管理側 給与管理
 *
 * UIモックのpage-payrollを再現。
 * ステップバー（勤怠締め→給与計算→確認・修正→確定→振込・通知）+ 社員テーブル + 詳細パネル。
 */

'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

const steps = ['勤怠締め', '給与計算', '確認・修正', '確定', '振込・通知'];
const currentStepIdx = 2;

const demoPayroll: {
  id: string;
  name: string;
  unitPrice: number;
  ratio: number;
  gross: number;
  deductions: number;
  net: number;
  hours: number;
  hoursWarn: boolean;
  status: string;
  earnings: { label: string; amount: number }[];
  deductionItems: { label: string; amount: number }[];
}[] = [];

function fmt(n: number) { return n.toLocaleString(); }

const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '未確認', cls: 'badge-wait' },
  confirmed: { label: '確認済', cls: 'badge-ok' },
  paid: { label: '振込済', cls: 'badge-info' },
};

export default function AdminPayrollPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? demoPayroll.find(p => p.id === selectedId) : null;
  const { toast, ToastUI } = useToast();

  const handleCalc = useCallback(async () => {
    try {
      await apiClient('/payroll/2026/3/calc', { method: 'POST' });
      toast('給与計算を実行しました');
    } catch {
      toast('給与計算の実行に失敗しました');
    }
  }, [toast]);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">給与管理</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-outline text-sm py-1.5">明細一括PDF</button>
          <button onClick={handleCalc} className="btn-primary text-sm py-1.5">給与計算実行</button>
        </div>
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

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">対象月</div>
          <div className="text-xl font-medium">2026年3月</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">総支給額合計</div>
          <div className="text-2xl font-medium tabular-nums">--<span className="text-sm font-normal text-secondary ml-1">円</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">対象人数</div>
          <div className="text-3xl font-medium">{demoPayroll.length}<span className="text-base font-normal text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">ステータス</div>
          <div className="mt-1"><span className="badge badge-info">確認中</span></div>
        </div>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[850px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">契約単価</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">還元率</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">総支給額</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">控除合計</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">差引支給額</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {demoPayroll.length === 0 ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoPayroll.map(p => {
              const st = statusBadge[p.status];
              return (
                <tr key={p.id} onClick={() => setSelectedId(p.id)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-base font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-base text-right">{p.ratio}%</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.gross)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(p.deductions)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums font-medium bg-yellow-50">{fmt(p.net)}</td>
                  <td className={`px-4 py-2.5 text-base text-right tabular-nums ${p.hoursWarn ? 'text-status-red-text font-medium' : ''}`}>{p.hours}h</td>
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
                <div className="text-xl font-medium">{selected.name}</div>
                <div className="text-sm text-secondary">2026年3月分</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">支給</div>
                {selected.earnings.map(item => (
                  <div key={item.label} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{item.label}</span><span className="tabular-nums">{fmt(item.amount)}円</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">控除</div>
                {selected.deductionItems.map(item => (
                  <div key={item.label} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{item.label}</span><span className="tabular-nums">{fmt(item.amount)}円</span>
                  </div>
                ))}
              </div>
              <div className="bg-yellow-50 rounded-md p-3">
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">差引支給額</div>
                <div className="text-2xl font-medium tabular-nums">{fmt(selected.net)}円</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="btn-outline flex-1 text-sm py-2">PDF出力</button>
                <button onClick={() => toast('給与修正はCSVインポートで対応してください')} className="btn-outline flex-1 text-sm py-2">修正</button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastUI />
    </div>
  );
}
