/**
 * 管理側 勤怠管理
 *
 * 月切替 + KPI + 精算幅ベースの超過/不足アラート + 全社員テーブル。
 * 行クリックで社員ごとの月次勤怠ページへ遷移。
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
  employeeId: string;
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
  const [monthlyStatus, setMonthlyStatus] = useState<Record<string, { attendanceConfirmed: boolean; clientConfirmed: boolean; clientImported: boolean }>>({});

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
        const [assignRes, payrollRes, statusRes] = await Promise.all([
          apiClient<{ data: AssignmentRow[] }>('/assignments?limit=200').catch(() => ({ data: [] as AssignmentRow[] })),
          apiClient<PayrollRow[]>(`/payroll/${year}/${month}`).catch(() => [] as PayrollRow[]),
          apiClient<Record<string, { attendanceConfirmed: boolean; clientConfirmed: boolean; clientImported: boolean }>>(`/attendance/admin/status/${year}/${month}`).catch(() => ({})),
        ]);

        if (cancelled) return;

        const assignments = assignRes.data ?? [];
        const payrollList = Array.isArray(payrollRes) ? payrollRes : [];

        const payrollMap = new Map<string, PayrollRow>();
        for (const p of payrollList) {
          payrollMap.set(p.employeeId, p);
        }

        const activeAssignments = assignments.filter(a => a.status === 'active');

        const rows: AttendanceRow[] = activeAssignments.map(a => {
          const payroll = payrollMap.get(a.employeeId);
          const lower = a.settlementLower || 140;
          const upper = a.settlementUpper || 180;
          const midpoint = Math.round((lower + upper) / 2);

          let otHours = 0;
          let actualHours = midpoint;
          if (payroll) {
            const hourlyRate = payroll.baseSalary > 0 ? Math.round(payroll.baseSalary / 160) : 0;
            if (hourlyRate > 0 && payroll.overtimePay > 0) {
              otHours = Math.round(payroll.overtimePay / (hourlyRate * 1.25));
            }
            actualHours = upper + otHours;
            if (otHours === 0) {
              actualHours = midpoint;
            }
          }

          let status: 'ok' | 'over' | 'under' = 'ok';
          if (actualHours > upper) status = 'over';
          else if (actualHours < lower) status = 'under';

          return {
            employeeId: a.employeeId,
            name: `${a.employee.lastName} ${a.employee.firstName}`,
            client: a.client.name,
            lower,
            upper,
            actual: actualHours,
            ot: otHours,
            leave: 0,
            status,
          };
        });

        if (!cancelled) {
          setAttendanceData(rows);
          setMonthlyStatus(statusRes);
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
    const headers = ['氏名', '稼働先', '精算幅', '実績', '残業', '有給', 'ステータス'];
    const rows = attendanceData.map(d => {
      const st = statusBadge[d.status];
      return [d.name, d.client, `${d.lower}〜${d.upper}h`, `${d.actual}h`, `${d.ot}h`, `${d.leave}日`, st?.label ?? d.status];
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

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働先</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">精算幅</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">実績</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">残業</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">有給</th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">打刻入力</th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">交通費入力</th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">本人勤怠確定</th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">現場勤怠確定</th>
              <th className="text-center text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">現場勤怠取込</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : attendanceData.length === 0 ? (
              <tr><td colSpan={11}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : attendanceData.map(d => {
              const st = statusBadge[d.status] || { label: d.status, cls: 'badge-wait' };
              const actualColor = d.actual < 140 ? 'text-status-red-text' : '';
              return (
                <tr
                  key={d.employeeId}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/attendance/${d.employeeId}?year=${year}&month=${month}`)}
                >
                  <td className="px-4 py-2.5 text-base font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{d.client}</td>
                  <td className="px-4 py-2.5 text-base text-right">{d.lower}〜{d.upper}h</td>
                  <td className={`px-4 py-2.5 text-base text-right tabular-nums font-medium ${actualColor}`}>{d.actual}h</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{d.ot}h</td>
                  <td className="px-4 py-2.5 text-base text-right">{d.leave}日</td>
                  <td className="px-4 py-2.5 text-center text-sm font-medium text-status-red-text">未完了</td>
                  <td className="px-4 py-2.5 text-center text-sm font-medium text-status-red-text">未完了</td>
                  {(() => {
                    const s = monthlyStatus[d.employeeId];
                    const attOk = s?.attendanceConfirmed;
                    const cliOk = s?.clientConfirmed;
                    const cliImp = s?.clientImported;
                    return (<>
                      <td className={`px-4 py-2.5 text-center text-sm font-medium ${attOk ? '' : 'text-status-red-text'}`}>{attOk ? '確定' : '未確定'}</td>
                      <td className={`px-4 py-2.5 text-center text-sm font-medium ${cliOk ? '' : 'text-status-red-text'}`}>{cliOk ? '確定' : '未確定'}</td>
                      <td className={`px-4 py-2.5 text-center text-sm font-medium ${cliImp ? '' : 'text-status-red-text'}`}>{cliImp ? '取込済' : '未取込'}</td>
                    </>);
                  })()}
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
