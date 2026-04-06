/**
 * 管理側 勤怠管理
 *
 * UIモックのpage-attendanceを再現。
 * 月切替 + KPI + 精算幅ベースの超過/不足アラート + 全社員テーブル。
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

const demoAttendance: { name: string; client: string; lower: number; upper: number; actual: number; ot: number; leave: number; status: string }[] = [];

const statusBadge: Record<string, { label: string; cls: string }> = {
  ok: { label: '正常', cls: 'badge-ok' },
  over: { label: '超過', cls: 'badge-danger' },
  under: { label: '不足', cls: 'badge-warn' },
};

export default function AdminAttendancePage() {
  const router = useRouter();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  const kpis = useMemo(() => ({
    avgActual: demoAttendance.length ? Math.round(demoAttendance.reduce((s, d) => s + d.actual, 0) / demoAttendance.length) : 0,
    overCount: demoAttendance.filter(d => d.status === 'over').length,
    underCount: demoAttendance.filter(d => d.status === 'under').length,
  }), []);
  const { toast, ToastUI } = useToast();

  const handleCsvExport = useCallback(() => {
    const headers = ['社員番号', '氏名', '出勤日数', '総労働時間', '残業時間', '有給取得', '欠勤', 'ステータス'];
    const rows = demoAttendance.map(d => {
      const st = statusBadge[d.status];
      return ['', d.name, '', String(d.actual), String(d.ot), String(d.leave), '', st?.label ?? d.status];
    });
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `勤怠_${year}年${month}月.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSVをダウンロードしました');
  }, [year, month, toast]);

  const handleMonthlyClose = useCallback(async () => {
    if (!confirm('月次締め処理を実行しますか？')) return;
    try {
      await apiClient(`/payroll/${year}/${month}/confirm`, { method: 'POST' });
      toast('月次締めを完了しました');
    } catch {
      toast('月次締め処理に失敗しました');
    }
  }, [year, month, toast]);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">勤怠管理</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/admin/attendance/reconciliation')} className="btn-outline text-sm py-1.5">現場勤怠表を取込</button>
          <button onClick={handleCsvExport} className="btn-outline text-sm py-1.5">CSVエクスポート</button>
          <button onClick={handleMonthlyClose} className="btn-primary text-sm py-1.5">月次締め処理</button>
        </div>
      </div>

      {/* 月切り替え */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => changeMonth(-1)} className="btn-outline py-1 px-3 text-sm">&lt;</button>
        <span className="text-lg font-medium min-w-[100px] text-center">{year}年{month}月</span>
        <button onClick={() => changeMonth(1)} className="btn-outline py-1 px-3 text-sm">&gt;</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">対象月</div>
          <div className="text-xl font-medium">{year}年{month}月</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">全社平均</div>
          <div className="text-3xl font-medium">{kpis.avgActual}<span className="text-base font-normal text-secondary ml-1">時間</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">精算超過</div>
          <div className="text-3xl font-medium text-status-red-text">{kpis.overCount}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">精算不足</div>
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
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働先</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">精算幅</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">実績</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">達成</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">残業</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">有給</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {demoAttendance.length === 0 ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoAttendance.map(d => {
              const pct = d.upper ? Math.round(d.actual / d.upper * 100) : 0;
              const barColor = d.status === 'over' ? 'bg-status-red-text' : d.status === 'under' ? 'bg-status-amber-text' : 'bg-status-green-text';
              const actualColor = d.status === 'over' ? 'text-status-red-text' : d.status === 'under' ? 'text-status-amber-text' : '';
              const st = statusBadge[d.status] || { label: d.status, cls: 'badge-wait' };
              return (
                <tr key={d.name} className="border-b border-border/20 hover:bg-[#FAFAF8] transition-colors">
                  <td className="px-4 py-2.5 text-base font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{d.client}</td>
                  <td className="px-4 py-2.5 text-base text-right">{d.lower}〜{d.upper}h</td>
                  <td className={`px-4 py-2.5 text-base text-right tabular-nums ${actualColor}`}>{d.actual}h</td>
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
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
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
