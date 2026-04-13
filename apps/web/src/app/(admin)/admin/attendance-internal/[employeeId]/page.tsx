/**
 * 社内勤怠 — 社員別 月次勤怠表
 *
 * /admin/attendance-internal/:employeeId?year=2026&month=4
 *
 * アサインなし社員の本人勤怠を表示。
 * 突合勤怠タブは不要（SES稼働していないため）。
 * 「本人勤怠を確定」ボタンで月次の勤怠ステータスを confirmed に更新。
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

interface AdminEdit {
  id: string;
  attendanceId: string;
  workDate: string;
  modifiedFields: string[];
  reason: string;
  objectionStatus: string;
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

function isFieldEdited(edits: AdminEdit[], dateStr: string, field: string): boolean {
  return edits.some(e => e.workDate.startsWith(dateStr) && e.modifiedFields.includes(field));
}

/* ---- コンポーネント ---- */

export default function InternalAttendanceDetailPage() {
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
  const [confirming, setConfirming] = useState(false);
  const [adminEdits, setAdminEdits] = useState<AdminEdit[]>([]);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editBreak, setEditBreak] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [pendingSave, setPendingSave] = useState<{ dateStr: string; clockIn: string; clockOut: string; breakMinutes: number } | null>(null);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
    window.history.replaceState(null, '', `/admin/attendance-internal/${employeeId}?year=${y}&month=${m}`);
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

  const fetchAdminEdits = useCallback(async () => {
    try {
      const data = await apiClient<AdminEdit[]>(`/attendance/admin-edits/${employeeId}/${year}/${month}`);
      setAdminEdits(data);
    } catch {
      setAdminEdits([]);
    }
  }, [employeeId, year, month]);

  useEffect(() => { fetchData(); fetchAdminEdits(); }, [fetchData, fetchAdminEdits]);

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
    const allConfirmed = recs.length > 0 && recs.every(r => r.status === 'confirmed');
    return { workDays, totalWorkH: (totalWork / 60).toFixed(1), totalOTH: (totalOT / 60).toFixed(1), missedCount, lateCount, absentCount, allConfirmed };
  }, [detail]);

  /* ---- 全日リスト ---- */

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

  const employeeName = detail?.employee
    ? `${detail.employee.lastName} ${detail.employee.firstName}`
    : '';
  const employeeCode = detail?.employee?.employeeCode || '';

  /* ---- CSV出力 ---- */

  const handleCsvExport = useCallback(() => {
    const headers = ['日付', '曜日', '出勤', '退勤', '休憩(分)', '実働', '残業', '備考'];
    const rows = allDays.map(({ day, dateStr, record }) => {
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
    const filename = `勤怠表_${employeeName}_${year}年${month}月.csv`;
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
  }, [allDays, year, month, employeeName, toast]);

  /* ---- 本人勤怠確定 ---- */

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const ym = `${year}-${String(month).padStart(2, '0')}`;
      await apiClient(`/attendance/admin/${employeeId}/confirm/${ym}`, { method: 'POST' });
      toast('本人勤怠を確定しました');
      fetchData();
    } catch {
      toast('確定に失敗しました');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <ToastUI />

      {/* ヘッダー: 戻る + 名前 | 月切り替え(中央) | 確定ボタン(右) */}
      <div className="flex items-center mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/attendance-internal')}
            className="btn-outline text-sm py-1.5 px-3"
          >
            &larr; 一覧に戻る
          </button>
          <h1 className="text-2xl font-medium">{employeeName}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2">
          <button onClick={() => changeMonth(-1)} className="btn-outline py-1 px-3 text-sm">&lt;</button>
          <span className="text-lg font-medium min-w-[120px] text-center">{year}年{month}月</span>
          <button onClick={() => changeMonth(1)} className="btn-outline py-1 px-3 text-sm">&gt;</button>
        </div>
        <div className="flex gap-2 items-center">
          {summary?.allConfirmed ? (
            <span className="badge badge-ok">確定済</span>
          ) : (
            <button
              disabled={confirming}
              onClick={handleConfirm}
              className="btn-primary text-sm py-2 px-5"
            >
              {confirming ? '処理中...' : '本人勤怠を確定'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <>
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
            <table className="w-full min-w-[850px]">
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
                  <th className="text-center text-xs text-secondary font-normal px-2 py-2.5 bg-[#FAFAFA] w-[60px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {allDays.map(({ day, dateStr, record }) => {
                  const dow = getDayOfWeek(dateStr);
                  const weekend = isWeekend(dateStr);
                  const dowColor = dow === '日' ? 'text-status-red-text' : dow === '土' ? 'text-blue-500' : '';
                  const rowBg = weekend ? 'bg-gray-50/60' : '';
                  const isEditing = editingRow === dateStr;

                  if (!record) {
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
                        <td className="px-2 py-2"></td>
                      </tr>
                    );
                  }

                  const notes: string[] = [];
                  if (record.isMissedClock) notes.push('打刻漏れ');
                  if (record.status === 'absent') notes.push('欠勤');
                  if (record.status === 'late') notes.push('遅刻');

                  const ciEdited = isFieldEdited(adminEdits, dateStr, 'clockIn');
                  const coEdited = isFieldEdited(adminEdits, dateStr, 'clockOut');
                  const brEdited = isFieldEdited(adminEdits, dateStr, 'breakMinutes');

                  return (
                    <tr key={day} className={`border-b border-border/10 hover:bg-[#FAFAF8] ${rowBg}`}>
                      <td className="px-4 py-2 text-sm tabular-nums">{month}/{day}</td>
                      <td className={`px-4 py-2 text-sm ${dowColor}`}>{dow}</td>
                      {isEditing ? (
                        <>
                          <td className="px-2 py-1"><input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="border rounded px-1 py-0.5 text-sm w-[90px]" /></td>
                          <td className="px-2 py-1"><input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="border rounded px-1 py-0.5 text-sm w-[90px]" /></td>
                          <td className="px-2 py-1"><input type="number" value={editBreak} onChange={e => setEditBreak(Number(e.target.value))} className="border rounded px-1 py-0.5 text-sm w-[60px]" min={0} max={480} /></td>
                        </>
                      ) : (
                        <>
                          <td className={`px-4 py-2 text-sm text-right tabular-nums ${ciEdited ? 'text-red-600 font-medium' : ''}`}>{fmtTime(record.clockIn)}</td>
                          <td className={`px-4 py-2 text-sm text-right tabular-nums ${coEdited ? 'text-red-600 font-medium' : ''}`}>{fmtTime(record.clockOut)}</td>
                          <td className={`px-4 py-2 text-sm text-right tabular-nums ${brEdited ? 'text-red-600 font-medium' : ''}`}>{record.breakMinutes}分</td>
                        </>
                      )}
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
                      <td className="px-2 py-2 text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              disabled={saving}
                              onClick={() => {
                                setPendingSave({ dateStr, clockIn: editClockIn, clockOut: editClockOut, breakMinutes: editBreak });
                                setEditReason('');
                                setShowReasonModal(true);
                              }}
                              className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90"
                            >保存</button>
                            <button onClick={() => setEditingRow(null)} className="text-xs px-2 py-1 text-secondary hover:text-primary">×</button>
                          </div>
                        ) : record.clockIn ? (
                          <button
                            onClick={() => {
                              setEditingRow(dateStr);
                              setEditClockIn(fmtTime(record.clockIn).replace('--', ''));
                              setEditClockOut(fmtTime(record.clockOut).replace('--', ''));
                              setEditBreak(record.breakMinutes);
                            }}
                            className="text-xs text-primary hover:underline"
                          >編集</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </>
      )}

      {/* 修正理由モーダル */}
      {showReasonModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[99]" onClick={() => { setShowReasonModal(false); setPendingSave(null); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-lg shadow-xl z-[100] w-full max-w-[420px]">
            <div className="p-5 border-b border-border/30">
              <h2 className="text-lg font-medium">修正理由を入力</h2>
              <p className="text-sm text-secondary mt-1">勤怠の修正理由を入力してください（必須）</p>
            </div>
            <div className="p-5">
              <textarea
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                placeholder="例: 打刻ミスの修正、実態に合わせた調整 など"
                className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
                rows={3}
                autoFocus
              />
            </div>
            <div className="p-5 border-t border-border/30 flex justify-end gap-2">
              <button
                onClick={() => { setShowReasonModal(false); setPendingSave(null); }}
                className="btn-outline text-sm py-2 px-4"
              >キャンセル</button>
              <button
                disabled={!editReason.trim() || saving}
                onClick={async () => {
                  if (!pendingSave) return;
                  setSaving(true);
                  try {
                    await apiClient(`/attendance/admin/${employeeId}/${pendingSave.dateStr}`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        clockIn: pendingSave.clockIn,
                        clockOut: pendingSave.clockOut,
                        breakMinutes: pendingSave.breakMinutes,
                        reason: editReason.trim(),
                      }),
                    });
                    toast('保存しました');
                    setShowReasonModal(false);
                    setPendingSave(null);
                    setEditingRow(null);
                    fetchData();
                    fetchAdminEdits();
                  } catch (err: any) {
                    toast(err?.message || '保存に失敗しました');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="btn-primary text-sm py-2 px-4"
              >{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
