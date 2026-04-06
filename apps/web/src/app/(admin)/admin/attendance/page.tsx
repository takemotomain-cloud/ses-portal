/**
 * 管理側 勤怠管理
 *
 * UIモックのpage-attendanceを再現。
 * 月切替 + KPI + 精算幅ベースの超過/不足アラート + 全社員テーブル。
 *
 * データソース:
 *   - GET /assignments?limit=200 → アクティブなアサイン（社員名・稼働先・精算幅）
 *   - GET /payroll/:year/:month  → 月次給与データ（残業時間等）
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---- 型定義 ---- */

interface AssignmentRow {
  id: string;
  employeeId: string;
  settlementLower: number;
  settlementUpper: number;
  status: string;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
  client: { id: string; name: string };
}

interface PayrollRow {
  employeeId: string;
  overtimePay: number;
  baseSalary: number;
  employee?: { employeeCode: string; lastName: string; firstName: string };
}

interface AttendanceRow {
  name: string;
  client: string;
  lower: number;
  upper: number;
  actual: number;
  ot: number;
  leave: number;
  status: 'ok' | 'over' | 'under';
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  ok: { label: '正常', cls: 'badge-ok' },
  over: { label: '超過', cls: 'badge-danger' },
  under: { label: '不足', cls: 'badge-warn' },
};

export default function AdminAttendancePage() {
  const router = useRouter();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [attendanceData, setAttendanceData] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  /* ---- データ取得 ---- */

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      try {
        // アサインデータと給与データを並列取得
        const [assignRes, payrollRes] = await Promise.all([
          apiClient<{ data: AssignmentRow[] }>('/assignments?limit=200').catch(() => ({ data: [] as AssignmentRow[] })),
          apiClient<PayrollRow[]>(`/payroll/${year}/${month}`).catch(() => [] as PayrollRow[]),
        ]);

        if (cancelled) return;

        const assignments = assignRes.data ?? [];
        const payrollList = Array.isArray(payrollRes) ? payrollRes : [];

        // 給与データをemployeeIdでマップ化
        const payrollMap = new Map<string, PayrollRow>();
        for (const p of payrollList) {
          payrollMap.set(p.employeeId, p);
        }

        // アクティブなアサインのみ対象
        const activeAssignments = assignments.filter(a => a.status === 'active');

        const rows: AttendanceRow[] = activeAssignments.map(a => {
          const payroll = payrollMap.get(a.employeeId);

          // 実績時間: 給与データからの推定（baseSalary / hourlyRate から逆算は困難なので、
          // 精算幅の中間値をデフォルト表示し、残業がある場合は上限+残業時間を加算）
          const lower = a.settlementLower || 140;
          const upper = a.settlementUpper || 180;
          const midpoint = Math.round((lower + upper) / 2);

          // 残業時間（給与データの overtimePay から概算。hourlyRate が不明なので簡易的に時間数を推定）
          let otHours = 0;
          let actualHours = midpoint;
          if (payroll) {
            // overtimePay / (baseSalary/160 * 1.25) で残業時間を逆算
            const hourlyRate = payroll.baseSalary > 0 ? Math.round(payroll.baseSalary / 160) : 0;
            if (hourlyRate > 0 && payroll.overtimePay > 0) {
              otHours = Math.round(payroll.overtimePay / (hourlyRate * 1.25));
            }
            actualHours = upper + otHours; // 残業があれば上限超え
            if (otHours === 0) {
              actualHours = midpoint; // 残業なしなら中間値
            }
          }

          // ステータス判定
          let status: 'ok' | 'over' | 'under' = 'ok';
          if (actualHours > upper) status = 'over';
          else if (actualHours < lower) status = 'under';

          return {
            name: `${a.employee.lastName} ${a.employee.firstName}`,
            client: a.client.name,
            lower,
            upper,
            actual: actualHours,
            ot: otHours,
            leave: 0, // 有給データは別APIのため現状0
            status,
          };
        });

        if (!cancelled) {
          setAttendanceData(rows);
        }
      } catch {
        if (!cancelled) {
          setAttendanceData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [year, month]);

  /* ---- KPI ---- */

  const kpis = useMemo(() => ({
    avgActual: attendanceData.length ? Math.round(attendanceData.reduce((s, d) => s + d.actual, 0) / attendanceData.length) : 0,
    overCount: attendanceData.filter(d => d.status === 'over').length,
    underCount: attendanceData.filter(d => d.status === 'under').length,
  }), [attendanceData]);

  const { toast, ToastUI } = useToast();

  const handleCsvExport = useCallback(() => {
    const headers = ['社員番号', '氏名', '出勤日数', '総労働時間', '残業時間', '有給取得', '欠勤', 'ステータス'];
    const rows = attendanceData.map(d => {
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
  }, [year, month, toast, attendanceData]);

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
          {attendanceData.filter(d => d.status === 'over').map(d => (
            <div key={d.name} className="card p-3 flex justify-between items-center border-l-4 border-l-status-red-text">
              <div>
                <span className="text-base font-medium">{d.name}</span>
                <span className="text-sm text-secondary ml-2">{d.client}</span>
              </div>
              <div className="text-sm text-status-red-text font-medium">精算幅超過 {d.actual}h / {d.upper}h</div>
            </div>
          ))}
          {attendanceData.filter(d => d.status === 'under').map(d => (
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
            {loading ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : attendanceData.length === 0 ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : attendanceData.map(d => {
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
