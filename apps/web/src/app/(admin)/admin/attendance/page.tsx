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

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

/* ---- 型定義 ---- */

interface AssignmentRow {
  id: string;
  employeeId: string;
  settlementLower: number;
  settlementUpper: number;
  startDate: string;
  endDate: string | null;
  status: string;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string; hireDate: string };
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

interface ObjectionDetail {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  modifiedFields: string[];
  reason: string;
  objectionReason: string | null;
}

interface MonthlyStatusItem {
  attendanceInputCompleted: boolean;
  transportInputCompleted: boolean;
  attendanceConfirmed: boolean;
  clientConfirmed: boolean;
  clientImported: boolean;
  clientAttendanceRequired?: boolean;
}

interface ClosureStatus {
  yearMonth: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  hasPostCloseChanges: boolean;
  readiness: {
    totalEmployees: number;
    confirmedCount: number;
    exemptCount: number;
    unconfirmedEmployees: Array<{
      employeeId: string;
      name: string;
      employeeCode: string;
      departmentName: string;
    }>;
  };
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  ok: { label: '正常', cls: 'badge-ok' },
  over: { label: '超過', cls: 'badge-danger' },
  under: { label: '不足', cls: 'badge-warn' },
};

const fieldLabel: Record<string, string> = { clockIn: '出勤', clockOut: '退勤', breakMinutes: '休憩' };

function overlapsMonth(assignment: AssignmentRow, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const hireDate = new Date(assignment.employee.hireDate);
  const start = new Date(assignment.startDate);
  const end = assignment.endDate ? new Date(assignment.endDate) : null;
  return hireDate <= monthEnd && start <= monthEnd && (!end || end >= monthStart);
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [attendanceData, setAttendanceData] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyStatus, setMonthlyStatus] = useState<Record<string, MonthlyStatusItem>>({});
  const [closureStatus, setClosureStatus] = useState<ClosureStatus | null>(null);
  const [objections, setObjections] = useState<ObjectionDetail[]>([]);
  const [showObjectionPopup, setShowObjectionPopup] = useState(false);
  const [showReadinessPopup, setShowReadinessPopup] = useState(false);
  const [closingMonth, setClosingMonth] = useState(false);
  const [reopeningMonth, setReopeningMonth] = useState(false);

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
        const [assignRes, payrollRes, statusRes, closureRes] = await Promise.all([
          apiClient<{ data: AssignmentRow[] }>('/assignments?limit=200').catch(() => ({ data: [] as AssignmentRow[] })),
          apiClient<PayrollRow[]>(`/payroll/${year}/${month}`).catch(() => [] as PayrollRow[]),
          apiClient<Record<string, MonthlyStatusItem>>(`/attendance/admin/status/${year}/${month}`).catch(() => ({})),
          apiClient<ClosureStatus>(`/attendance/admin/closure/${year}/${month}`).catch(() => null as any),
        ]);

        if (cancelled) return;

        const assignments = assignRes.data ?? [];
        const payrollList = Array.isArray(payrollRes) ? payrollRes : [];

        const payrollMap = new Map<string, PayrollRow>();
        for (const p of payrollList) {
          payrollMap.set(p.employeeId, p);
        }

        const activeAssignments = assignments.filter(
          (a) => a.status === 'active' && overlapsMonth(a, year, month),
        );

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
          // _summary を分離してからstatusにセット
          const { _summary, ...statusMap } = statusRes as any;
          setMonthlyStatus(statusMap);
          setObjections(_summary?.objections ?? []);
          setClosureStatus(closureRes);
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

  const kpis = useMemo(() => {
    const statusEntries = Object.values(monthlyStatus) as MonthlyStatusItem[];
    return {
      missingAttendanceInput: statusEntries.filter(s => !s.attendanceInputCompleted).length,
      missingTransportInput: statusEntries.filter(s => !s.transportInputCompleted).length,
      unconfirmedAttendance: statusEntries.filter(s => !s.attendanceConfirmed).length,
      unconfirmedClient: statusEntries.filter(s => (s.clientAttendanceRequired !== false) && !s.clientConfirmed).length,
      overCount: attendanceData.filter(d => d.status === 'over').length,
      underCount: attendanceData.filter(d => d.status === 'under').length,
    };
  }, [attendanceData, monthlyStatus]);

  async function refreshAll() {
    setLoading(true);
    try {
      const [assignRes, payrollRes, statusRes, closureRes] = await Promise.all([
        apiClient<{ data: AssignmentRow[] }>('/assignments?limit=200').catch(() => ({ data: [] as AssignmentRow[] })),
        apiClient<PayrollRow[]>(`/payroll/${year}/${month}`).catch(() => [] as PayrollRow[]),
        apiClient<Record<string, MonthlyStatusItem>>(`/attendance/admin/status/${year}/${month}`).catch(() => ({})),
        apiClient<ClosureStatus>(`/attendance/admin/closure/${year}/${month}`).catch(() => null as any),
      ]);

      const assignments = assignRes.data ?? [];
      const payrollList = Array.isArray(payrollRes) ? payrollRes : [];
      const payrollMap = new Map<string, PayrollRow>();
      for (const p of payrollList) payrollMap.set(p.employeeId, p);

      const rows: AttendanceRow[] = assignments.filter(
        (a) => a.status === 'active' && overlapsMonth(a, year, month),
      ).map(a => {
        const payroll = payrollMap.get(a.employeeId);
        const lower = a.settlementLower || 140;
        const upper = a.settlementUpper || 180;
        const midpoint = Math.round((lower + upper) / 2);
        let otHours = 0;
        let actualHours = midpoint;
        if (payroll) {
          const hourlyRate = payroll.baseSalary > 0 ? Math.round(payroll.baseSalary / 160) : 0;
          if (hourlyRate > 0 && payroll.overtimePay > 0) otHours = Math.round(payroll.overtimePay / (hourlyRate * 1.25));
          actualHours = otHours === 0 ? midpoint : upper + otHours;
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

      const { _summary, ...statusMap } = statusRes as any;
      setAttendanceData(rows);
      setMonthlyStatus(statusMap);
      setObjections(_summary?.objections ?? []);
      setClosureStatus(closureRes);
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseMonth() {
    setClosingMonth(true);
    try {
      await apiClient(`/attendance/admin/closure/${year}/${month}/close`, { method: 'POST' });
      await refreshAll();
    } finally {
      setClosingMonth(false);
    }
  }

  async function handleReopenMonth() {
    setReopeningMonth(true);
    try {
      await apiClient(`/attendance/admin/closure/${year}/${month}/reopen`, { method: 'POST' });
      await refreshAll();
    } finally {
      setReopeningMonth(false);
    }
  }


  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">勤怠管理</h1>
        <div className="flex items-center gap-3">
          {closureStatus && (
            <div className="flex items-center gap-2">
              <span className={`badge ${closureStatus.status === 'closed' ? 'badge-ok' : 'badge-wait'}`}>
                {closureStatus.status === 'closed' ? '月次確定済' : '月次未確定'}
              </span>
              {user?.role === 'admin' && (
                closureStatus.status === 'closed' ? (
                  <button
                    onClick={handleReopenMonth}
                    disabled={reopeningMonth}
                    className="btn-outline text-sm py-1.5 disabled:opacity-50"
                  >
                    {reopeningMonth ? '解除中...' : '確定解除'}
                  </button>
                ) : (
                  <button
                    onClick={handleCloseMonth}
                    disabled={closingMonth}
                    className="btn-primary text-sm py-1.5 disabled:opacity-50"
                  >
                    {closingMonth ? '確定中...' : '月次確定'}
                  </button>
                )
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="btn-outline py-1 px-3 text-sm">&lt;</button>
            <span className="text-lg font-medium min-w-[100px] text-center">{year}年{month}月</span>
            <button onClick={() => changeMonth(1)} className="btn-outline py-1 px-3 text-sm">&gt;</button>
          </div>
          <button onClick={() => router.push('/admin/attendance/reconciliation')} className="btn-outline text-sm py-1.5">現場勤怠表を取込</button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">打刻入力未完了</div>
          <div className={`text-3xl font-medium ${kpis.missingAttendanceInput > 0 ? 'text-status-red-text' : ''}`}>{kpis.missingAttendanceInput}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">交通費入力未完了</div>
          <div className={`text-3xl font-medium ${kpis.missingTransportInput > 0 ? 'text-status-red-text' : ''}`}>{kpis.missingTransportInput}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">本人勤怠未確定</div>
          <div className={`text-3xl font-medium ${kpis.unconfirmedAttendance > 0 ? 'text-status-red-text' : ''}`}>{kpis.unconfirmedAttendance}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className={`card p-4 ${closureStatus?.readiness.unconfirmedEmployees.length ? 'cursor-pointer hover:bg-page transition-colors' : ''}`} onClick={() => closureStatus?.readiness.unconfirmedEmployees.length && setShowReadinessPopup(true)}>
          <div className="text-xs text-secondary">現場勤怠未確定</div>
          <div className={`text-3xl font-medium ${kpis.unconfirmedClient > 0 ? 'text-status-red-text' : ''}`}>{kpis.unconfirmedClient}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className={`card p-4 ${objections.length > 0 ? 'cursor-pointer hover:bg-page transition-colors' : ''}`} onClick={() => objections.length > 0 && setShowObjectionPopup(true)}>
          <div className="text-xs text-secondary">異議あり</div>
          <div className={`text-3xl font-medium ${objections.length > 0 ? 'text-status-red-text' : ''}`}>{objections.length}<span className="text-base font-normal ml-1">件</span></div>
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
                  {(() => {
                    const s = monthlyStatus[d.employeeId];
                    const inputOk = s?.attendanceInputCompleted;
                    const transportOk = s?.transportInputCompleted;
                    return (
                      <>
                        <td className={`px-4 py-2.5 text-center text-sm font-medium ${inputOk ? '' : 'text-status-red-text'}`}>{inputOk ? '完了' : '未完了'}</td>
                        <td className={`px-4 py-2.5 text-center text-sm font-medium ${transportOk ? '' : 'text-status-red-text'}`}>{transportOk ? '完了' : '未完了'}</td>
                      </>
                    );
                  })()}
                  {(() => {
                    const s = monthlyStatus[d.employeeId];
                    const attOk = s?.attendanceConfirmed;
                    const cliOk = s?.clientConfirmed;
                    const cliImp = s?.clientImported;
                    const cliReq = s?.clientAttendanceRequired ?? true;
                    return (<>
                      <td className={`px-4 py-2.5 text-center text-sm font-medium ${attOk ? '' : 'text-status-red-text'}`}>{attOk ? '確定' : '未確定'}</td>
                      <td className={`px-4 py-2.5 text-center text-sm font-medium ${!cliReq ? 'text-secondary' : cliOk ? '' : 'text-status-red-text'}`}>{!cliReq ? '不要' : cliOk ? '確定' : '未確定'}</td>
                      <td className={`px-4 py-2.5 text-center text-sm font-medium ${!cliReq ? 'text-secondary' : cliImp ? '' : 'text-status-red-text'}`}>{!cliReq ? '不要' : cliImp ? '取込済' : '未取込'}</td>
                    </>);
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 異議あり詳細ポップアップ */}
      {showObjectionPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowObjectionPopup(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-lg font-medium">異議あり一覧（{objections.length}件）</h2>
              <button onClick={() => setShowObjectionPopup(false)} className="text-secondary hover:text-primary text-xl leading-none">✕</button>
            </div>
            {objections.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-secondary">異議はありません</div>
            ) : (
              <ul>
                {objections.map((o, idx) => {
                  const d = new Date(o.workDate);
                  const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                  return (
                    <li
                      key={o.id}
                      className={`px-5 py-3.5 cursor-pointer hover:bg-[#FAFAF8] transition-colors ${idx < objections.length - 1 ? 'border-b border-border/20' : ''}`}
                      onClick={() => { setShowObjectionPopup(false); router.push(`/admin/attendance/${o.employeeId}?year=${year}&month=${month}`); }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-base">{o.employeeName}</span>
                        <span className="text-sm text-secondary">{dateStr}</span>
                        <span className="px-2 py-0.5 rounded text-2xs font-medium bg-status-red-bg text-status-red-text">異議あり</span>
                      </div>
                      <div className="text-sm text-secondary">
                        修正: {o.modifiedFields.map(f => fieldLabel[f] || f).join('・')} — {o.reason}
                      </div>
                      {o.objectionReason && (
                        <div className="text-sm text-status-red-text mt-0.5">
                          異議理由: {o.objectionReason}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {showReadinessPopup && closureStatus && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowReadinessPopup(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-lg font-medium">月次確定前の未入力一覧</h2>
              <button onClick={() => setShowReadinessPopup(false)} className="text-secondary hover:text-primary text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-3 text-sm text-secondary border-b border-border/20">
              確定済 {closureStatus.readiness.confirmedCount}名 / 対象 {closureStatus.readiness.totalEmployees - closureStatus.readiness.exemptCount}名
            </div>
            {closureStatus.readiness.unconfirmedEmployees.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-secondary">未入力の社員はいません</div>
            ) : (
              <ul>
                {closureStatus.readiness.unconfirmedEmployees.map((item, idx) => (
                  <li
                    key={item.employeeId}
                    className={`px-5 py-3.5 cursor-pointer hover:bg-[#FAFAF8] transition-colors ${idx < closureStatus.readiness.unconfirmedEmployees.length - 1 ? 'border-b border-border/20' : ''}`}
                    onClick={() => {
                      setShowReadinessPopup(false);
                      router.push(`/admin/attendance/${item.employeeId}?year=${year}&month=${month}`);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">{item.name}</span>
                      <span className="text-sm text-secondary">{item.employeeCode}</span>
                    </div>
                    <div className="text-sm text-secondary mt-0.5">{item.departmentName || '部署未設定'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
