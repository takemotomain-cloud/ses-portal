/**
 * 社員側 勤怠画面（API連携版）
 *
 * APIから月次勤怠データを取得。データがなければ空表示。
 * 各行に「修正」ボタンがあり、出勤/退勤/休憩の修正申請が可能。
 * 修正は管理者承認後に反映される。
 */

'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiClient, getToken } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { combineDateTimeAware, isCrossMidnight, isClockOutNextDay } from '@/lib/attendance-time';

interface AttendanceRecordRaw {
  id: string;
  workDate?: string;
  date?: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  status: string;
}

interface AttendanceRecord extends AttendanceRecordRaw {
  date: string;
}

interface ApprovedLeave {
  startDate: string;
  endDate: string;
  days: number;
  leaveType: string;
}

interface CalendarDay {
  day: number;
  dateStr: string;
  dow: number;
  record?: AttendanceRecord;
  isLeave: boolean;
}

interface CorrectionItem {
  id: string;
  attendanceId: string;
  originalClockIn: string | null;
  originalClockOut: string | null;
  originalBreakMinutes: number | null;
  newClockIn: string | null;
  newClockOut: string | null;
  newBreakMinutes: number | null;
  reason: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  attendance: { workDate: string };
}

function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return '--';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ISO日時文字列 → HH:MM形式（input[type=time]用） */
function toTimeValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}


const DOW = ['日', '月', '火', '水', '木', '金', '土'];

interface AdminEditInfo {
  id: string;
  workDate: string;
  modifiedFields: string[];
  reason: string;
  objectionStatus: string;
}

function isFieldEdited(edits: AdminEditInfo[], dateStr: string, field: string): boolean {
  return edits.some(e => e.workDate.startsWith(dateStr) && e.modifiedFields.includes(field));
}

function getEditsForDate(edits: AdminEditInfo[], dateStr: string): AdminEditInfo[] {
  return edits.filter(e => e.workDate.startsWith(dateStr));
}

const statusLabel: Record<string, { text: string; cls: string }> = {
  pending: { text: '申請中', cls: 'bg-status-amber-bg text-status-amber-text' },
  approved: { text: '承認済', cls: 'bg-status-green-bg text-status-green-text' },
  rejected: { text: '却下', cls: 'bg-status-red-bg text-status-red-text' },
};

export default function AttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<ApprovedLeave[]>([]);
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const { toast, ToastUI } = useToast();
  const [adminEdits, setAdminEdits] = useState<AdminEditInfo[]>([]);

  // 異議関連
  const [objectionTarget, setObjectionTarget] = useState<AdminEditInfo | null>(null);
  const [objectionReason, setObjectionReason] = useState('');
  const [submittingObjection, setSubmittingObjection] = useState(false);

  /* ---- 現場勤怠表アップロード ---- */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const uploadYearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const [uploading, setUploading] = useState(false);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [myUploads, setMyUploads] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    records: number;
    reconciliation: {
      summary: { totalDays: number; matchCount: number; discrepancyCount: number; clientOnlyCount: number; systemOnlyCount: number };
    } | null;
  } | null>(null);

  const loadMyUploads = useCallback(() => {
    apiClient<any[]>('/attendance/reconciliation/my-uploads')
      .then(setMyUploads)
      .catch(() => setMyUploads([]));
  }, []);

  useEffect(() => {
    loadMyUploads();
  }, [loadMyUploads]);

  const handleUploadFile = useCallback(async () => {
    if (!uploadFile || !uploadYearMonth) {
      toast('対象年月とファイルを指定してください');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('yearMonth', uploadYearMonth);

      const token = getToken();
      const res = await fetch('/api/attendance/reconciliation/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'アップロードに失敗しました' }));
        throw new Error(err.message);
      }

      const data = await res.json();
      setUploadResult({
        records: data.records?.length || 0,
        reconciliation: data.reconciliation,
      });
      toast('アップロード完了しました！');
      setUploadFile(null);
      loadMyUploads();
    } catch (err: any) {
      toast(err.message || 'エラーが発生しました');
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadYearMonth, toast, loadMyUploads]);

  const handleUploadDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setUploadDragOver(false);
    if (e.dataTransfer.files?.[0]) setUploadFile(e.dataTransfer.files[0]);
  }, []);

  /* ---- 修正モーダル ---- */
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  /** レコードがない日を開く場合に使う日付文字列 */
  const [editDateStr, setEditDateStr] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editBreak, setEditBreak] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editAbsentMode, setEditAbsentMode] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient<{ records: AttendanceRecordRaw[]; approvedLeaves: ApprovedLeave[] }>(`/attendance/${year}/${month}`)
      .then(data => {
        setRecords(data.records.map(r => ({ ...r, date: r.workDate || r.date || '' })));
        setApprovedLeaves(data.approvedLeaves || []);
      })
      .catch(() => { setRecords([]); setApprovedLeaves([]); })
      .finally(() => setLoading(false));
    // 管理者修正履歴を取得（赤色表示用）
    apiClient<AdminEditInfo[]>(`/attendance/admin-edits/my/${year}/${month}`)
      .then(setAdminEdits)
      .catch(() => setAdminEdits([]));
  }, [year, month]);

  useEffect(() => {
    apiClient<CorrectionItem[]>('/attendance/corrections/my')
      .then(setCorrections)
      .catch(() => setCorrections([]));
  }, []);

  const filteredCorrections = useMemo(() => {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    return corrections.filter(c => c.attendance.workDate.startsWith(ym));
  }, [corrections, year, month]);

  const filteredUploads = useMemo(() => {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    return myUploads.filter((u: any) => u.yearMonth === ym);
  }, [myUploads, year, month]);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  /** 有給日付のSet */
  const leaveDateSet = useMemo(() => {
    const s = new Set<string>();
    for (const lv of approvedLeaves) {
      const start = new Date(lv.startDate);
      const end = new Date(lv.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
    }
    return s;
  }, [approvedLeaves]);

  /** フルカレンダー（1日〜月末日） */
  const fullCalendar = useMemo<CalendarDay[]>(() => {
    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of records) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      recordMap.set(key, r);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        day,
        dateStr,
        dow: new Date(year, month - 1, day).getDay(),
        record: recordMap.get(dateStr),
        isLeave: leaveDateSet.has(dateStr),
      };
    });
  }, [records, year, month, leaveDateSet]);

  const summary = useMemo(() => {
    const worked = records.filter(d => d.status === 'normal' || d.clockOut);
    const totalWork = worked.reduce((s, d) => s + (d.workMinutes || 0), 0);
    const totalOT = worked.reduce((s, d) => s + (d.overtimeMinutes || 0), 0);
    const missed = records.filter(d => d.clockIn && !d.clockOut && d.status !== 'working').length;
    const absent = records.filter(d => d.status === 'absent').length;
    // 当月の有給日数を算出
    const ymPrefix = `${year}-${String(month).padStart(2, '0')}`;
    let paidLeave = 0;
    for (const ds of leaveDateSet) {
      if (ds.startsWith(ymPrefix)) paidLeave++;
    }
    return {
      workDays: worked.length,
      totalWork: formatMinutes(totalWork),
      totalOT: formatMinutes(totalOT),
      absent,
      missed,
      paidLeave,
    };
  }, [records, year, month, leaveDateSet]);

  /** 修正申請中の勤怠IDセット */
  const pendingCorrectionIds = useMemo(() => {
    return new Set(corrections.filter(c => c.status === 'pending').map(c => c.attendanceId));
  }, [corrections]);

  function openEdit(row: AttendanceRecord) {
    setEditTarget(row);
    setEditDateStr(null);
    setEditClockIn(toTimeValue(row.clockIn));
    setEditClockOut(toTimeValue(row.clockOut));
    setEditBreak(String(row.breakMinutes));
    setEditReason('');
    setEditAbsentMode(false);
    setAbsentReason('');
  }

  function openEditForDate(dateStr: string) {
    setEditTarget(null);
    setEditDateStr(dateStr);
    setEditClockIn('');
    setEditClockOut('');
    setEditBreak('0');
    setEditReason('');
    setEditAbsentMode(true);
    setAbsentReason('');
  }

  async function submitAbsent() {
    const dateStr = editTarget ? editTarget.date.split('T')[0] : editDateStr;
    if (!dateStr) return;

    setSubmitting(true);
    try {
      await apiClient('/attendance/absent-date', {
        method: 'POST',
        body: JSON.stringify({ date: dateStr, reason: absentReason.trim() || undefined }),
      });
      toast('欠勤登録しました');
      setEditTarget(null);
      setEditDateStr(null);
      // データ再取得
      const data = await apiClient<{ records: AttendanceRecordRaw[]; approvedLeaves: ApprovedLeave[] }>(`/attendance/${year}/${month}`);
      setRecords(data.records.map(r => ({ ...r, date: r.workDate || r.date || '' })));
      setApprovedLeaves(data.approvedLeaves || []);
    } catch (e: any) {
      toast(e.message || '欠勤登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCorrection() {
    if (!editTarget) return;
    if (!editReason.trim()) {
      toast('修正理由を入力してください');
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = editTarget.date.split('T')[0];
      const body: any = { reason: editReason.trim() };

      // 変更があった項目のみ送信
      const origIn = toTimeValue(editTarget.clockIn);
      const origOut = toTimeValue(editTarget.clockOut);
      const origBreak = String(editTarget.breakMinutes);

      // 日跨ぎ補正: 出勤・退勤を組み立て、退勤が出勤より早い場合は退勤を翌日扱いに
      const inHHMM = editClockIn && editClockIn !== origIn ? editClockIn : (origIn || undefined);
      const outHHMM = editClockOut && editClockOut !== origOut ? editClockOut : (origOut || undefined);
      const built = combineDateTimeAware(dateStr, inHHMM, outHHMM);
      if (editClockIn && editClockIn !== origIn) {
        body.newClockIn = built.clockIn;
      }
      if (editClockOut && editClockOut !== origOut) {
        body.newClockOut = built.clockOut;
      }
      if (editBreak !== origBreak) {
        body.newBreakMinutes = parseInt(editBreak, 10);
      }

      if (!body.newClockIn && !body.newClockOut && body.newBreakMinutes === undefined) {
        toast('変更する項目がありません');
        setSubmitting(false);
        return;
      }

      await apiClient(`/attendance/${editTarget.id}/correction`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      toast('修正申請を送信しました');
      setEditTarget(null);

      // 修正申請一覧を再取得
      const updated = await apiClient<CorrectionItem[]>('/attendance/corrections/my');
      setCorrections(updated);
    } catch (e: any) {
      toast(e.message || '申請に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 月切り替え */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => changeMonth(-1)}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page"
        >
          ‹
        </button>
        <span className="text-lg font-medium min-w-[120px] text-center">
          {year}年{month}月
        </span>
        <button
          onClick={() => changeMonth(1)}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page"
        >
          ›
        </button>
      </div>

      {/* タブ切り替え */}
      <div className="flex border-b border-border/40">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          勤怠一覧
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          修正申請{filteredCorrections.length > 0 && ` (${filteredCorrections.length})`}
        </button>
        <button
          onClick={() => setActiveTab(2)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 2 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          現場勤怠表
        </button>
      </div>

      {activeTab === 0 && (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '出勤日数', value: `${summary.workDays}日` },
              { label: '実働時間', value: summary.totalWork },
              { label: '残業時間', value: summary.totalOT },
              { label: '欠勤日数', value: `${summary.absent}日` },
              { label: '打刻漏れ', value: `${summary.missed}件`, warn: summary.missed > 0 },
              { label: '有給取得', value: `${summary.paidLeave}日` },
            ].map((item) => (
              <div key={item.label} className="card px-3 py-2.5 text-center">
                <div className="text-2xs text-secondary mb-0.5">{item.label}</div>
                <div className={`text-lg font-medium ${item.warn ? 'text-status-red-text' : ''}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* 勤怠テーブル（フルカレンダー） */}
          <div className="card p-0 overflow-x-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
            ) : (
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border">
                    {['日付', '出勤', '退勤', '休憩', '稼働', '残業', ''].map(h => (
                      <th key={h || '_op'} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-page/50 first:pl-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fullCalendar.map((cd) => {
                    const row = cd.record;
                    const isWeekend = cd.dow === 0 || cd.dow === 6;
                    const isAbsent = row?.status === 'absent';
                    const isMissed = row ? (row.clockIn && !row.clockOut && row.status !== 'working') : false;
                    const isWorking = row?.status === 'working';
                    const hasPending = row ? pendingCorrectionIds.has(row.id) : false;
                    const isConfirmed = row?.status === 'confirmed';

                    // 行クリック可能かどうか
                    const canClick = !isWeekend && !isConfirmed && !hasPending && !cd.isLeave;

                    let rowBg = '';
                    if (isWeekend) rowBg = 'bg-page/40';
                    else if (isMissed) rowBg = 'bg-status-red-bg/30';
                    else if (isWorking) rowBg = 'bg-status-blue-bg/30';

                    function handleRowClick() {
                      if (!canClick) return;
                      if (row && !isAbsent) {
                        openEdit(row);
                      } else if (!row) {
                        openEditForDate(cd.dateStr);
                      }
                    }

                    return (
                      <tr
                        key={cd.dateStr}
                        onClick={handleRowClick}
                        className={`border-b border-border-light last:border-b-0 text-md ${rowBg}
                          ${canClick && (row && !isAbsent || !row) ? 'cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors' : ''}`}
                      >
                        <td className="px-3 py-2.5 pl-4 font-medium whitespace-nowrap">
                          {cd.day}日
                          <span className={`ml-1 ${isWeekend ? 'text-status-red-text' : 'text-secondary'}`}>
                            ({DOW[cd.dow]})
                          </span>
                        </td>

                        {/* 有給休暇の日 */}
                        {cd.isLeave && !row ? (
                          <td colSpan={6} className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded text-2xs font-medium bg-status-green-bg text-status-green-text">
                              有給休暇
                            </span>
                          </td>
                        ) : isAbsent ? (
                          <td colSpan={6} className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded text-2xs font-medium bg-status-red-bg text-status-red-text">
                              欠勤
                            </span>
                          </td>
                        ) : row ? (
                          <>
                            <td className={`px-3 py-2.5 tabular-nums ${isFieldEdited(adminEdits, cd.dateStr, 'clockIn') ? 'text-red-600 font-medium' : ''}`}>
                              {cd.isLeave ? (
                                <span className="px-2 py-0.5 rounded text-2xs font-medium bg-status-green-bg text-status-green-text">有給休暇</span>
                              ) : formatTime(row.clockIn)}
                            </td>
                            <td className={`px-3 py-2.5 tabular-nums ${isFieldEdited(adminEdits, cd.dateStr, 'clockOut') ? 'text-red-600 font-medium' : ''}`}>
                              {!row.clockOut ? (
                                <span className="text-status-red-text">--:--</span>
                              ) : (
                                <>
                                  {formatTime(row.clockOut)}
                                  {isClockOutNextDay(cd.dateStr, row.clockOut) && (
                                    <span className="ml-1 text-2xs text-secondary/70">(翌)</span>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={isFieldEdited(adminEdits, cd.dateStr, 'breakMinutes') ? 'text-red-600 font-medium' : 'text-secondary'}>{row.breakMinutes}分</span>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">{formatMinutes(row.workMinutes)}</td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {row.overtimeMinutes && row.overtimeMinutes > 0 ? (
                                <span className="text-status-amber-text">{formatMinutes(row.overtimeMinutes)}</span>
                              ) : formatMinutes(row.overtimeMinutes)}
                            </td>
                            <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                              {(() => {
                                const dateEdits = getEditsForDate(adminEdits, cd.dateStr);
                                const latestEdit = dateEdits[dateEdits.length - 1];
                                if (!latestEdit) return null;
                                if (latestEdit.objectionStatus === 'objected') {
                                  return <span className="px-2 py-0.5 rounded text-2xs font-medium bg-status-amber-bg text-status-amber-text whitespace-nowrap">異議済み</span>;
                                }
                                return (
                                  <button
                                    onClick={() => setObjectionTarget(latestEdit)}
                                    className="px-2 py-1 rounded border border-status-red-text text-status-red-text text-2xs font-medium hover:bg-status-red-bg transition-colors whitespace-nowrap"
                                  >
                                    異議あり
                                  </button>
                                );
                              })()}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5 text-secondary">--:--</td>
                            <td className="px-3 py-2.5 text-secondary">--:--</td>
                            <td className="px-3 py-2.5 text-secondary">--</td>
                            <td className="px-3 py-2.5 text-secondary">--</td>
                            <td className="px-3 py-2.5 text-secondary">--</td>
                            <td></td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* 修正申請履歴タブ */}
      {activeTab === 1 && (
        <div className="card p-0">
          {filteredCorrections.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-secondary">修正申請の履歴はありません</div>
          ) : (
            filteredCorrections.map((c, idx) => {
              const wd = new Date(c.attendance.workDate);
              const st = statusLabel[c.status] || { text: c.status, cls: 'bg-muted text-secondary' };
              return (
                <div
                  key={c.id}
                  className={`px-5 py-3.5 ${idx < filteredCorrections.length - 1 ? 'border-b border-border/20' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {wd.getFullYear()}年{wd.getMonth() + 1}月{wd.getDate()}日({DOW[wd.getDay()]})
                    </span>
                    <span className={`px-2 py-0.5 rounded text-2xs font-medium ${st.cls}`}>{st.text}</span>
                  </div>
                  <div className="text-sm text-secondary space-y-0.5">
                    {c.newClockIn && (
                      <div>出勤: {formatTime(c.originalClockIn)} → {formatTime(c.newClockIn)}</div>
                    )}
                    {c.newClockOut && (
                      <div>退勤: {formatTime(c.originalClockOut)} → {formatTime(c.newClockOut)}</div>
                    )}
                    {c.newBreakMinutes !== null && (
                      <div>休憩: {c.originalBreakMinutes}分 → {c.newBreakMinutes}分</div>
                    )}
                    <div>理由: {c.reason}</div>
                    {c.rejectReason && (
                      <div className="text-status-red-text">却下理由: {c.rejectReason}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 現場勤怠表タブ */}
      {activeTab === 2 && (
        <div className="space-y-5">
          {/* アップロードエリア */}
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="text-base font-medium mb-1">現場勤怠表のアップロード</h3>
              <p className="text-sm text-secondary">クライアントから受け取った勤怠表をアップロードしてください。</p>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
              onDragLeave={() => setUploadDragOver(false)}
              onDrop={handleUploadDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${uploadDragOver ? 'border-primary bg-accent' : uploadFile ? 'border-status-green-text bg-status-green-bg' : 'border-border hover:border-primary/50'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.gif,.webp"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }}
              />
              {uploadFile ? (
                <div>
                  <p className="text-base font-medium text-primary">{uploadFile.name}</p>
                  <p className="text-sm text-secondary mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                  {!uploading && (
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                      className="text-sm text-status-red-text mt-2 hover:underline"
                    >
                      削除
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-base text-secondary">タップしてファイルを選択</p>
                  <p className="text-2xs text-secondary/70 mt-1">Excel / CSV / PDF / 画像</p>
                </div>
              )}
            </div>

            <button
              onClick={handleUploadFile}
              disabled={!uploadFile || !uploadYearMonth || uploading}
              className="w-full py-3 rounded-lg bg-primary text-white text-md font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  アップロード中...
                </>
              ) : (
                'アップロード'
              )}
            </button>
          </div>

          {/* アップロード完了 */}
          {uploadResult && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-status-green-bg flex items-center justify-center text-status-green-text text-lg">✓</span>
                <h3 className="text-base font-medium">アップロード完了しました！</h3>
              </div>
              <p className="text-sm text-secondary">{uploadResult.records}件の勤怠データを読み取りました。</p>
              <button
                onClick={() => setUploadResult(null)}
                className="w-full py-2 rounded-lg border border-border text-sm text-primary hover:bg-page transition-colors"
              >
                閉じる
              </button>
            </div>
          )}

          {/* アップロード履歴 */}
          <div>
            <h3 className="text-base font-medium mb-2">アップロード履歴</h3>
            <div className="card p-0">
              {filteredUploads.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-secondary">アップロード履歴はありません</div>
              ) : (
                <ul>
                  {filteredUploads.map((u: any, idx: number) => (
                      <li
                        key={u.id}
                        className={`px-4 py-3 ${idx < filteredUploads.length - 1 ? 'border-b border-border-light' : ''}`}
                      >
                        <div className="mb-1">
                          <span className="text-md font-medium">{u.yearMonth}</span>
                        </div>
                        <div className="text-sm text-secondary">
                          <span>{u.fileName || 'ファイル'}</span>
                          {u.client?.name && <span className="ml-2">({u.client.name})</span>}
                        </div>
                        <div className="text-2xs text-secondary/70 mt-0.5">
                          {(() => { const d = new Date(u.createdAt); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}時${String(d.getMinutes()).padStart(2, '0')}分`; })()}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 修正申請モーダル */}
      {(editTarget || editDateStr) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-border/30">
              <h2 className="text-lg font-medium">
                {editAbsentMode ? '欠勤登録' : '勤怠修正申請'}
              </h2>
              <p className="text-sm text-secondary mt-0.5">
                {(() => {
                  const ds = editTarget ? editTarget.date.split('T')[0] : editDateStr!;
                  const [y, m, d] = ds.split('-').map(Number);
                  const dt = new Date(y, m - 1, d);
                  return `${y}年${m}月${d}日(${DOW[dt.getDay()]})`;
                })()}
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {editAbsentMode ? (
                /* 欠勤モード */
                <div>
                  <label className="block text-sm text-secondary mb-1">欠勤理由</label>
                  <textarea
                    rows={3}
                    value={absentReason}
                    onChange={e => setAbsentReason(e.target.value)}
                    placeholder="欠勤の理由を入力してください（任意）"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary resize-none"
                  />
                </div>
              ) : (
                /* 修正モード */
                <>
                  <div>
                    <label className="block text-sm text-secondary mb-1">出勤時間</label>
                    <input
                      type="time"
                      value={editClockIn}
                      onChange={e => setEditClockIn(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-secondary mb-1">
                      退勤時間
                      {editClockIn && editClockOut && isCrossMidnight(editClockIn, editClockOut) && (
                        <span className="ml-2 text-xs text-secondary/70">（翌日扱い）</span>
                      )}
                    </label>
                    <input
                      type="time"
                      value={editClockOut}
                      onChange={e => setEditClockOut(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-secondary mb-1">休憩時間（分）</label>
                    <input
                      type="number"
                      min={0}
                      max={480}
                      value={editBreak}
                      onChange={e => setEditBreak(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-secondary mb-1">
                      修正理由 <span className="text-status-red-text">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editReason}
                      onChange={e => setEditReason(e.target.value)}
                      placeholder="修正の理由を入力してください"
                      className="w-full border border-border rounded-lg px-3 py-2.5 text-md outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* 欠勤にするボタン */}
                  {editTarget && editTarget.status !== 'absent' && (
                    <button
                      onClick={() => setEditAbsentMode(true)}
                      className="w-full py-2 rounded-lg text-sm border border-border text-secondary hover:bg-page transition-colors"
                    >
                      この日を欠勤にする
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border/30 flex justify-end gap-2">
              {editAbsentMode && editTarget && (
                <button
                  onClick={() => setEditAbsentMode(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-page transition-colors mr-auto"
                >
                  戻る
                </button>
              )}
              <button
                onClick={() => { setEditTarget(null); setEditDateStr(null); }}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-page transition-colors"
              >
                キャンセル
              </button>
              {editAbsentMode ? (
                <button
                  onClick={submitAbsent}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm bg-status-red-text text-white hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {submitting ? '処理中...' : '欠勤確定'}
                </button>
              ) : (
                <button
                  onClick={submitCorrection}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? '送信中...' : '申請する'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 異議申し立てモーダル */}
      {objectionTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4" onClick={() => { setObjectionTarget(null); setObjectionReason(''); }}>
          <div className="relative bg-card w-full max-w-md rounded-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary mb-2">異議申し立て</h3>
            <p className="text-sm text-secondary mb-1">
              {objectionTarget.workDate.split('T')[0]} の勤怠修正に対して異議を申し立てます
            </p>
            <p className="text-sm text-secondary mb-4">修正理由: {objectionTarget.reason}</p>
            <textarea
              value={objectionReason}
              onChange={e => setObjectionReason(e.target.value)}
              placeholder="異議の理由を入力してください"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setObjectionTarget(null); setObjectionReason(''); }}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-secondary hover:bg-page"
              >キャンセル</button>
              <button
                disabled={!objectionReason.trim() || submittingObjection}
                onClick={async () => {
                  setSubmittingObjection(true);
                  try {
                    await apiClient(`/attendance/admin-edit/${objectionTarget.id}/object`, {
                      method: 'POST',
                      body: JSON.stringify({ reason: objectionReason.trim() }),
                    });
                    setAdminEdits(prev => prev.map(e => e.id === objectionTarget.id ? { ...e, objectionStatus: 'objected' } : e));
                    toast('異議を送信しました');
                    setObjectionTarget(null);
                    setObjectionReason('');
                  } catch {
                    toast('送信に失敗しました');
                  } finally {
                    setSubmittingObjection(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-lg bg-status-red-text text-white text-sm font-medium hover:bg-status-red-text/90 disabled:opacity-50"
              >{submittingObjection ? '送信中...' : '異議を送信'}</button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
