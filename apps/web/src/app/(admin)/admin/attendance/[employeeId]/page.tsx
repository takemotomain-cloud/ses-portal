/**
 * 社員別 月次勤怠表
 *
 * /admin/attendance/:employeeId?year=2026&month=4
 *
 * 1ヶ月分の日別勤怠を一覧表示。
 * 上部に集計サマリー（出勤日数・総労働時間・残業時間・打刻漏れ件数）。
 * 月切り替え・印刷対応。
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ---- 型定義 ---- */

interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  status: string;
  isMissedClock: boolean;
}

interface ReconcileResultRecord {
  workDate: string;
  matchStatus: 'match' | 'discrepancy' | 'client_only' | 'system_only';
  clientStart: string | null;
  clientEnd: string | null;
  clientBreak: number | null;
  clientHours: number | null;
  systemStart: string | null;
  systemEnd: string | null;
  systemBreak: number | null;
  systemHours: number | null;
  resolvedBy: string;
}

interface ReconciliationData {
  uploadId: string | null;
  uploadStatus: string | null;
  clientName: string | null;
  results: ReconcileResultRecord[];
}

interface EmployeeInfo {
  id: string;
  lastName: string;
  firstName: string;
  employeeCode: string;
}

interface MonthlyDetail {
  employee: EmployeeInfo | null;
  records: AttendanceRecord[];
}

/* ---- ヘルパー ---- */

function fmtTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtMinToHM(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[new Date(dateStr).getDay()];
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

/* ---- コンポーネント ---- */

export default function AttendanceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  const employeeId = params.employeeId as string;
  const initialYear = Number(searchParams.get('year')) || new Date().getFullYear();
  const initialMonth = Number(searchParams.get('month')) || new Date().getMonth() + 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [detail, setDetail] = useState<MonthlyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<0 | 1>(searchParams.get('tab') === 'recon' ? 1 : 0);
  const [reconData, setReconData] = useState<ReconciliationData | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null); // dateStr being edited
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<'client' | 'employee' | null>(null);
  const [correctionMode, setCorrectionMode] = useState(false);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
    // URLも更新（ブラウザ履歴に残す）
    window.history.replaceState(null, '', `/admin/attendance/${employeeId}?year=${y}&month=${m}`);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<MonthlyDetail>(`/attendance/admin/${employeeId}/${year}/${month}`);
      setDetail(data);
    } catch {
      toast('勤怠データの取得に失敗しました');
      setDetail({ employee: null, records: [] });
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- 突合データ取得（lazy load） ---- */

  const fetchReconData = useCallback(async () => {
    setReconLoading(true);
    try {
      const ym = `${year}-${String(month).padStart(2, '0')}`;
      const data = await apiClient<ReconciliationData>(
        `/attendance/reconciliation/employee/${employeeId}/${ym}`,
      );
      setReconData(data);
    } catch {
      setReconData(null);
    } finally {
      setReconLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    if (activeTab === 1) fetchReconData();
  }, [activeTab, fetchReconData]);

  /* ---- 集計 ---- */

  const summary = useMemo(() => {
    if (!detail) return null;
    const recs = detail.records;
    const workDays = recs.filter(r => r.workMinutes && r.workMinutes > 0).length;
    const totalWork = recs.reduce((s, r) => s + (r.workMinutes || 0), 0);
    const totalOT = recs.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
    const missedCount = recs.filter(r => r.isMissedClock).length;
    const lateCount = recs.filter(r => r.status === 'late').length;
    const absentCount = recs.filter(r => r.status === 'absent').length;
    return {
      workDays,
      totalWorkH: (totalWork / 60).toFixed(1),
      totalOTH: (totalOT / 60).toFixed(1),
      missedCount,
      lateCount,
      absentCount,
    };
  }, [detail]);

  /* ---- 全日リスト（空白日も含む） ---- */

  const allDays = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const recordMap = new Map<number, AttendanceRecord>();
    if (detail) {
      for (const r of detail.records) {
        const day = new Date(r.workDate).getDate();
        recordMap.set(day, r);
      }
    }

    const result: { day: number; dateStr: string; record: AttendanceRecord | null }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, dateStr, record: recordMap.get(d) || null });
    }
    return result;
  }, [detail, year, month]);

  /* ---- 突合サマリー ---- */

  const reconSummary = useMemo(() => {
    if (!reconData || reconData.results.length === 0) return null;
    const r = reconData.results;
    const matchCount = r.filter(x => x.matchStatus === 'match').length;
    const discrepancyCount = r.filter(x => x.matchStatus === 'discrepancy').length;
    const clientOnly = r.filter(x => x.matchStatus === 'client_only').length;
    const systemOnly = r.filter(x => x.matchStatus === 'system_only').length;
    const matchRate = r.length > 0 ? Math.round((matchCount / r.length) * 100) : 0;
    return { total: r.length, matchCount, discrepancyCount, clientOnly, systemOnly, matchRate };
  }, [reconData]);

  /* ---- 突合データの日別マップ ---- */

  const allDaysRecon = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const reconMap = new Map<number, ReconcileResultRecord>();
    if (reconData) {
      for (const r of reconData.results) {
        const day = new Date(r.workDate).getDate();
        reconMap.set(day, r);
      }
    }
    const result: { day: number; dateStr: string; record: ReconcileResultRecord | null }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, dateStr, record: reconMap.get(d) || null });
    }
    return result;
  }, [reconData, year, month]);

  const employeeName = detail?.employee
    ? `${detail.employee.lastName} ${detail.employee.firstName}`
    : '---';
  const employeeCode = detail?.employee?.employeeCode || '';

  /* ---- CSV出力 ---- */

  const handleCsvExport = useCallback(() => {
    let headers: string[];
    let rows: string[][];
    let filename: string;

    if (activeTab === 1) {
      headers = ['日付', '曜日', 'ステータス', '現場出勤', '現場退勤', '現場時間', '自社出勤', '自社退勤', '自社時間'];
      rows = allDaysRecon.map(({ day, dateStr, record }) => {
        const dow = getDayOfWeek(dateStr);
        if (!record) return [`${month}/${day}`, dow, '', '', '', '', '', '', ''];
        const statusLabels: Record<string, string> = { match: '一致', discrepancy: '要確認', client_only: '現場のみ', system_only: '自社のみ' };
        return [
          `${month}/${day}`, dow,
          statusLabels[record.matchStatus] || '',
          record.clientStart || '', record.clientEnd || '', record.clientHours != null ? String(record.clientHours) : '',
          record.systemStart || '', record.systemEnd || '', record.systemHours != null ? String(record.systemHours) : '',
        ];
      });
      filename = `突合勤怠_${employeeName}_${year}年${month}月.csv`;
    } else {
      headers = ['日付', '曜日', '出勤', '退勤', '休憩(分)', '実働', '残業', '備考'];
      rows = allDays.map(({ day, dateStr, record }) => {
        const dow = getDayOfWeek(dateStr);
        if (!record) return [`${month}/${day}`, dow, '', '', '', '', '', ''];
        const notes: string[] = [];
        if (record.isMissedClock) notes.push('打刻漏れ');
        if (record.status === 'absent') notes.push('欠勤');
        if (record.status === 'late') notes.push('遅刻');
        return [
          `${month}/${day}`, dow,
          fmtTime(record.clockIn), fmtTime(record.clockOut),
          String(record.breakMinutes), fmtMinToHM(record.workMinutes),
          record.overtimeMinutes && record.overtimeMinutes > 0 ? fmtMinToHM(record.overtimeMinutes) : '',
          notes.join('、'),
        ];
      });
      filename = `勤怠表_${employeeName}_${year}年${month}月.csv`;
    }

    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSVをダウンロードしました');
  }, [activeTab, allDays, allDaysRecon, year, month, employeeName, toast]);

  return (
    <div>
      <ToastUI />

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/attendance')}
            className="btn-outline text-sm py-1.5 px-3"
          >
            &larr; 一覧に戻る
          </button>
          <div>
            <h1 className="text-2xl font-medium">{employeeName}</h1>
            {employeeCode && (
              <div className="text-sm text-secondary">{employeeCode}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCsvExport} className="btn-outline text-sm py-1.5">CSVエクスポート</button>
        </div>
      </div>

      {/* 月切り替え */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => changeMonth(-1)} className="btn-outline py-1 px-3 text-sm">&lt;</button>
        <span className="text-lg font-medium min-w-[120px] text-center">{year}年{month}月</span>
        <button onClick={() => changeMonth(1)} className="btn-outline py-1 px-3 text-sm">&gt;</button>
      </div>

      {/* タブ切り替え */}
      <div className="flex border-b border-border/40 mb-4">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          本人勤怠
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          突合勤怠
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {/* === Tab 0: 本人勤怠 === */}
          {activeTab === 0 && (<>
          {/* 集計サマリー */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
              <div className="card p-4">
                <div className="text-xs text-secondary">出勤日数</div>
                <div className="text-2xl font-medium">{summary.workDays}<span className="text-sm font-normal text-secondary ml-1">日</span></div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-secondary">総労働時間</div>
                <div className="text-2xl font-medium">{summary.totalWorkH}<span className="text-sm font-normal text-secondary ml-1">h</span></div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-secondary">残業時間</div>
                <div className="text-2xl font-medium">{summary.totalOTH}<span className="text-sm font-normal text-secondary ml-1">h</span></div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-secondary">打刻漏れ</div>
                <div className={`text-2xl font-medium ${summary.missedCount > 0 ? 'text-status-red-text' : ''}`}>
                  {summary.missedCount}<span className="text-sm font-normal ml-1">件</span>
                </div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-secondary">遅刻</div>
                <div className={`text-2xl font-medium ${summary.lateCount > 0 ? 'text-status-amber-text' : ''}`}>
                  {summary.lateCount}<span className="text-sm font-normal ml-1">回</span>
                </div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-secondary">欠勤</div>
                <div className={`text-2xl font-medium ${summary.absentCount > 0 ? 'text-status-red-text' : ''}`}>
                  {summary.absentCount}<span className="text-sm font-normal ml-1">日</span>
                </div>
              </div>
            </div>
          )}

          {/* 日別テーブル */}
          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] w-[80px]">日付</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] w-[50px]">曜日</th>
                  <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">出勤</th>
                  <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">退勤</th>
                  <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">休憩</th>
                  <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">実働</th>
                  <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">残業</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">備考</th>
                </tr>
              </thead>
              <tbody>
                {allDays.map(({ day, dateStr, record }) => {
                  const dow = getDayOfWeek(dateStr);
                  const weekend = isWeekend(dateStr);
                  const dowColor = dow === '日' ? 'text-status-red-text' : dow === '土' ? 'text-blue-500' : '';
                  const rowBg = weekend ? 'bg-gray-50/60' : '';

                  if (!record) {
                    // 打刻なし（休日 or 未出勤）
                    return (
                      <tr key={day} className={`border-b border-border/10 ${rowBg}`}>
                        <td className="px-4 py-2 text-sm tabular-nums">{month}/{day}</td>
                        <td className={`px-4 py-2 text-sm ${dowColor}`}>{dow}</td>
                        <td className="px-4 py-2 text-sm text-right text-secondary">--</td>
                        <td className="px-4 py-2 text-sm text-right text-secondary">--</td>
                        <td className="px-4 py-2 text-sm text-right text-secondary">--</td>
                        <td className="px-4 py-2 text-sm text-right text-secondary">--</td>
                        <td className="px-4 py-2 text-sm text-right text-secondary">--</td>
                        <td className="px-4 py-2 text-sm text-secondary">—</td>
                      </tr>
                    );
                  }

                  const notes: string[] = [];
                  if (record.isMissedClock) notes.push('打刻漏れ');
                  if (record.status === 'absent') notes.push('欠勤');
                  if (record.status === 'late') notes.push('遅刻');

                  return (
                    <tr key={day} className={`border-b border-border/10 hover:bg-[#FAFAF8] ${rowBg}`}>
                      <td className="px-4 py-2 text-sm tabular-nums">{month}/{day}</td>
                      <td className={`px-4 py-2 text-sm ${dowColor}`}>{dow}</td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums">{fmtTime(record.clockIn)}</td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums">{fmtTime(record.clockOut)}</td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums">{record.breakMinutes}分</td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums font-medium">{fmtMinToHM(record.workMinutes)}</td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums">
                        {record.overtimeMinutes && record.overtimeMinutes > 0 ? fmtMinToHM(record.overtimeMinutes) : '--'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {notes.length > 0 ? (
                          <span className="text-status-red-text text-xs">{notes.join('、')}</span>
                        ) : (
                          <span className="text-secondary text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 本人勤怠を確定ボタン */}
          <div className="flex justify-end mt-5">
            <button
              disabled={confirming !== null}
              onClick={async () => {
                setConfirming('employee');
                try {
                  const ym = `${year}-${String(month).padStart(2, '0')}`;
                  await apiClient(`/attendance/admin/${employeeId}/confirm/${ym}`, { method: 'POST' });
                  toast('本人勤怠を確定しました');
                  fetchData();
                } catch {
                  toast('確定に失敗しました');
                } finally {
                  setConfirming(null);
                }
              }}
              className="btn-primary text-sm py-2 px-5"
            >
              {confirming === 'employee' ? '処理中...' : '本人勤怠を確定'}
            </button>
          </div>
          </>)}

          {/* === Tab 1: 突合勤怠 === */}
          {activeTab === 1 && (<>
            {reconLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : !reconData || reconData.results.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-secondary mb-3">突合データがありません</p>
                <button
                  onClick={() => router.push('/admin/attendance/reconciliation')}
                  className="btn-outline text-sm py-1.5"
                >
                  勤怠突合ページへ
                </button>
              </div>
            ) : (<>
              {/* 突合サマリー */}
              {reconSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
                  <div className="card p-4">
                    <div className="text-xs text-secondary">突合日数</div>
                    <div className="text-2xl font-medium">{reconSummary.total}<span className="text-sm font-normal text-secondary ml-1">日</span></div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs text-secondary">一致</div>
                    <div className="text-2xl font-medium text-status-green-text">{reconSummary.matchCount}<span className="text-sm font-normal ml-1">日</span></div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs text-secondary">要確認</div>
                    <div className={`text-2xl font-medium ${reconSummary.discrepancyCount > 0 ? 'text-yellow-700' : ''}`}>{reconSummary.discrepancyCount}<span className="text-sm font-normal ml-1">日</span></div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs text-secondary">現場のみ</div>
                    <div className={`text-2xl font-medium ${reconSummary.clientOnly > 0 ? 'text-status-amber-text' : ''}`}>{reconSummary.clientOnly}<span className="text-sm font-normal ml-1">日</span></div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs text-secondary">自社のみ</div>
                    <div className={`text-2xl font-medium ${reconSummary.systemOnly > 0 ? 'text-blue-500' : ''}`}>{reconSummary.systemOnly}<span className="text-sm font-normal ml-1">日</span></div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs text-secondary">一致率</div>
                    <div className="text-2xl font-medium">{reconSummary.matchRate}<span className="text-sm font-normal text-secondary ml-1">%</span></div>
                  </div>
                </div>
              )}

              {/* 突合テーブル */}
              <div className="card p-0 overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] w-[70px]">日付</th>
                      <th className="text-left text-xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] w-[40px]">曜日</th>
                      <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">現場出勤</th>
                      <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">現場退勤</th>
                      <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">現場時間</th>
                      <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] border-l border-border/30">本人出勤</th>
                      <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">本人退勤</th>
                      <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA]">本人時間</th>
                      <th className="text-center text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] border-l border-border/30">差異</th>
                      <th className="text-center text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDaysRecon.map(({ day, dateStr, record }) => {
                      const dow = getDayOfWeek(dateStr);
                      const weekend = isWeekend(dateStr);
                      const dowColor = dow === '日' ? 'text-status-red-text' : dow === '土' ? 'text-blue-500' : '';
                      const isEditing = editingRow === dateStr;

                      if (!record) {
                        const rowBg = weekend ? 'bg-gray-50/60' : '';
                        return (
                          <tr key={day} className={`border-b border-border/10 ${rowBg}`}>
                            <td className="px-3 py-2 text-sm tabular-nums">{month}/{day}</td>
                            <td className={`px-2 py-2 text-sm ${dowColor}`}>{dow}</td>
                            <td className="px-3 py-2 text-sm text-right text-secondary">--</td>
                            <td className="px-3 py-2 text-sm text-right text-secondary">--</td>
                            <td className="px-3 py-2 text-sm text-right text-secondary">--</td>
                            <td className="px-3 py-2 text-sm text-right text-secondary border-l border-border/30">--</td>
                            <td className="px-3 py-2 text-sm text-right text-secondary">--</td>
                            <td className="px-3 py-2 text-sm text-right text-secondary">--</td>
                            <td className="px-3 py-2 text-sm text-center text-secondary border-l border-border/30">—</td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        );
                      }

                      // 差異計算（現場時間 - 本人時間）
                      const diffHours = (record.clientHours != null && record.systemHours != null)
                        ? record.clientHours - record.systemHours
                        : null;
                      const diffMinutes = diffHours != null ? Math.round(diffHours * 60) : null;
                      const isDiscrepancy = record.matchStatus === 'discrepancy';
                      const rowBg = isDiscrepancy
                        ? 'bg-yellow-50'
                        : weekend ? 'bg-gray-50/60' : '';

                      const diffDisplay = diffMinutes != null
                        ? `${diffMinutes >= 0 ? '+' : ''}${Math.floor(Math.abs(diffMinutes) / 60)}:${String(Math.abs(diffMinutes) % 60).padStart(2, '0')}`
                        : '—';

                      return (
                        <tr key={day} className={`border-b border-border/10 hover:bg-[#FAFAF8] ${rowBg}`}>
                          <td className="px-3 py-2 text-sm tabular-nums">{month}/{day}</td>
                          <td className={`px-2 py-2 text-sm ${dowColor}`}>{dow}</td>
                          <td className="px-3 py-2 text-sm text-right tabular-nums">{record.clientStart || '--'}</td>
                          <td className="px-3 py-2 text-sm text-right tabular-nums">{record.clientEnd || '--'}</td>
                          <td className="px-3 py-2 text-sm text-right tabular-nums font-medium">{record.clientHours != null ? `${record.clientHours}h` : '--'}</td>
                          {isEditing ? (<>
                            <td className="px-1 py-1 border-l border-border/30">
                              <input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)}
                                className="w-full text-sm px-1 py-1 border border-primary rounded text-right tabular-nums" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)}
                                className="w-full text-sm px-1 py-1 border border-primary rounded text-right tabular-nums" />
                            </td>
                          </>) : (<>
                            <td className="px-3 py-2 text-sm text-right tabular-nums border-l border-border/30">{record.systemStart || '--'}</td>
                            <td className="px-3 py-2 text-sm text-right tabular-nums">{record.systemEnd || '--'}</td>
                          </>)}
                          <td className="px-3 py-2 text-sm text-right tabular-nums font-medium">{record.systemHours != null ? `${record.systemHours}h` : '--'}</td>
                          <td className={`px-3 py-2 text-sm text-center tabular-nums border-l border-border/30 ${isDiscrepancy ? 'text-yellow-800 font-medium' : 'text-secondary'}`}>
                            {diffDisplay}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {(() => {
                              const isConfirmed = reconData?.uploadStatus === 'confirmed';
                              const canEdit = !isConfirmed || correctionMode;
                              if (isEditing && canEdit) {
                                return (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      disabled={saving}
                                      onClick={async () => {
                                        setSaving(true);
                                        try {
                                          await apiClient(`/attendance/admin/${employeeId}/${dateStr}`, {
                                            method: 'PATCH',
                                            body: JSON.stringify({
                                              clockIn: editClockIn,
                                              clockOut: editClockOut,
                                              correction: isConfirmed,
                                            }),
                                          });
                                          toast('保存しました');
                                          setEditingRow(null);
                                          fetchData();
                                          fetchReconData();
                                        } catch {
                                          toast('保存に失敗しました');
                                        } finally {
                                          setSaving(false);
                                        }
                                      }}
                                      className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90"
                                    >保存</button>
                                    <button onClick={() => setEditingRow(null)} className="text-xs px-2 py-1 text-secondary hover:text-primary">×</button>
                                  </div>
                                );
                              }
                              if (canEdit && (record.systemStart || record.systemEnd)) {
                                return (
                                  <button
                                    onClick={() => {
                                      setEditingRow(dateStr);
                                      setEditClockIn(record.systemStart || '');
                                      setEditClockOut(record.systemEnd || '');
                                    }}
                                    className="text-xs text-primary hover:underline"
                                  >編集</button>
                                );
                              }
                              return null;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 現場勤怠 確定 / 修正ボタン */}
              <div className="flex justify-end mt-5 gap-3">
                {reconData.uploadStatus === 'confirmed' && !correctionMode ? (
                  <button
                    onClick={() => {
                      setCorrectionMode(true);
                      toast('修正モードに切り替えました');
                    }}
                    className="btn-outline text-sm py-2 px-5"
                  >
                    修正する
                  </button>
                ) : (
                  <>
                    {correctionMode && (
                      <button
                        onClick={() => {
                          setCorrectionMode(false);
                          setEditingRow(null);
                        }}
                        className="btn-outline text-sm py-2 px-5"
                      >
                        キャンセル
                      </button>
                    )}
                    <button
                      disabled={confirming !== null}
                      onClick={async () => {
                        setConfirming('client');
                        try {
                          await apiClient(`/attendance/reconciliation/${reconData.uploadId}/confirm`, { method: 'PUT' });
                          toast(correctionMode ? '修正を確定しました' : '現場勤怠を確定しました');
                          setCorrectionMode(false);
                          setEditingRow(null);
                          fetchReconData();
                        } catch {
                          toast('確定に失敗しました');
                        } finally {
                          setConfirming(null);
                        }
                      }}
                      className="btn-primary text-sm py-2 px-5"
                    >
                      {confirming === 'client' ? '処理中...' : correctionMode ? '修正を確定' : '現場勤怠を確定'}
                    </button>
                  </>
                )}
              </div>
            </>)}
          </>)}
        </>
      )}
    </div>
  );
}
