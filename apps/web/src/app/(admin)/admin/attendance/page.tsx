/**
 * 管理側 勤怠管理
 *
 * UIモックのpage-attendanceを再現。
 * 月切替 + KPI + 精算幅ベースの超過/不足アラート + 全社員テーブル。
 */

'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ui/toast';

const demoAttendance: { name: string; client: string; lower: number; upper: number; actual: number; ot: number; leave: number; status: string }[] = [];

export default function AdminAttendancePage() {
  const [year] = useState(2026);
  const [month, setMonth] = useState(3);

  const kpis = useMemo(() => ({
    total: demoAttendance.length,
    overCount: demoAttendance.filter(d => d.status === 'over').length,
    underCount: demoAttendance.filter(d => d.status === 'under').length,
    avgActual: demoAttendance.length ? Math.round(demoAttendance.reduce((s, d) => s + d.actual, 0) / demoAttendance.length) : 0,
  }), []);
  const { toast, ToastUI } = useToast();

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">勤怠管理</h1>
        <div className="flex gap-2">
          <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline text-sm py-1.5">CSVエクスポート</button>
          <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline text-sm py-1.5">月次締め処理</button>
        </div>
      </div>

      {/* 月切り替え */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setMonth(m => m - 1)} className="btn-outline py-1 px-3 text-sm">&lt;</button>
        <span className="text-lg font-medium min-w-[100px] text-center">{year}年{month}月</span>
        <button onClick={() => setMonth(m => m + 1)} className="btn-outline py-1 px-3 text-sm">&gt;</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">対象社員</div>
          <div className="text-3xl font-medium">{kpis.total}<span className="text-base font-normal text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">平均実績</div>
          <div className="text-3xl font-medium">{kpis.avgActual}<span className="text-base font-normal text-secondary ml-1">h</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">超過アラート</div>
          <div className="text-3xl font-medium text-status-red-text">{kpis.overCount}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">不足アラート</div>
          <div className="text-3xl font-medium text-status-amber-text">{kpis.underCount}<span className="text-base font-normal ml-1">名</span></div>
        </div>
      </div>

      {/* アラート表示 */}
      {(kpis.overCount > 0 || kpis.underCount > 0) && (
        <div className="space-y-2 mb-4">
          {demoAttendance.filter(d => d.status === 'over').map(d => (
            <div key={d.name} className="card p-3 flex justify-between items-center border-l-4 border-l-status-red-text">
              <div>
                <span className="text-base font-medium">{d.name}</span>
                <span className="text-sm text-secondary ml-2">{d.client}</span>
              </div>
              <div className="text-sm text-status-red-text font-medium">精算幅超過 {d.actual}h / {d.upper}h</div>
            </div>
          ))}
          {demoAttendance.filter(d => d.status === 'under').map(d => (
            <div key={d.name} className="card p-3 flex justify-between items-center border-l-4 border-l-status-amber-text">
              <div>
                <span className="text-base font-medium">{d.name}</span>
                <span className="text-sm text-secondary ml-2">{d.client}</span>
              </div>
              <div className="text-sm text-status-amber-text font-medium">精算幅不足 {d.actual}h / {d.lower}h</div>
            </div>
          ))}
        </div>
      )}

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              {['氏名', '稼働先', '精算幅', '実績', '達成', '残業', '有給'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demoAttendance.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoAttendance.map(d => {
              const pct = d.upper ? Math.round(d.actual / d.upper * 100) : 0;
              const barColor = d.status === 'over' ? 'bg-status-red-text' : d.status === 'under' ? 'bg-status-amber-text' : 'bg-status-green-text';
              return (
                <tr key={d.name} className="border-b border-border/20 hover:bg-[#FAFAF8] transition-colors">
                  <td className="px-4 py-2.5 text-base font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{d.client}</td>
                  <td className="px-4 py-2.5 text-base text-right">{d.lower}〜{d.upper}h</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{d.actual}h</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-[3px] bg-border/40 rounded overflow-hidden">
                        <div className={`h-full rounded ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-secondary">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{d.ot}h</td>
                  <td className="px-4 py-2.5 text-base text-right">{d.leave}日</td>
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
