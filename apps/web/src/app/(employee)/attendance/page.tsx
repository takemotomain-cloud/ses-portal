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

/** workDate(YYYY-MM-DD) + HH:MM → ISO文字列 */
function combineDateTime(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).toISOString();
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

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
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const { toast, ToastUI } = useToast();

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
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editBreak, setEditBreak] = useState('');
  const [editReason, setEditReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient<AttendanceRecordRaw[]>(`/attendance/${year}/${month}`)
      .then(rows => setRecords(rows.map(r => ({ ...r, date: r.workDate || r.date || '' }))))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
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

  const summary = useMemo(() => {
    const worked = records.filter(d => d.status === 'normal' || d.clockOut);
    const totalWork = worked.reduce((s, d) => s + (d.workMinutes || 0), 0);
    const totalOT = worked.reduce((s, d) => s + (d.overtimeMinutes || 0), 0);
    const missed = records.filter(d => d.clockIn && !d.clockOut && d.status !== 'working').length;
    return {
      workDays: worked.length,
      totalWork: formatMinutes(totalWork),
      totalOT: formatMinutes(totalOT),
      absent: 0,
      missed,
      paidLeave: 0,
    };
  }, [records]);

  /** 修正申請中の勤怠IDセット */
  const pendingCorrectionIds = useMemo(() => {
    return new Set(corrections.filter(c => c.status === 'pending').map(c => c.attendanceId));
  }, [corrections]);

  function openEdit(row: AttendanceRecord) {
    setEditTarget(row);
    setEditClockIn(toTimeValue(row.clockIn));
    setEditClockOut(toTimeValue(row.clockOut));
    setEditBreak(String(row.breakMinutes));
    setEditReason('');
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

      if (editClockIn && editClockIn !== origIn) {
        body.newClockIn = combineDateTime(dateStr, editClockIn);
      }
      if (editClockOut && editClockOut !== origOut) {
        body.newClockOut = combineDateTime(dateStr, editClockOut);
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

          {/* 勤怠テーブル */}
          <div className="card p-0 overflow-x-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
            ) : records.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-secondary">勤怠データはありません</div>
            ) : (
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-border">
                    {['日付', '出勤', '退勤', '休憩', '稼働', '残業', ''].map(h => (
                      <th key={h} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-page/50 first:pl-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => {
                    const d = new Date(row.date);
                    const isMissed = row.clockIn && !row.clockOut && row.status !== 'working';
                    const isWorking = row.status === 'working';
                    const hasPending = pendingCorrectionIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-border-light last:border-b-0 text-md
                          ${isMissed ? 'bg-status-red-bg/30' : ''}
                          ${isWorking ? 'bg-status-blue-bg/30' : ''}`}
                      >
                        <td className="px-3 py-2.5 pl-4 font-medium">
                          {d.getMonth() + 1}月{d.getDate()}日
                          <span className="text-secondary ml-1">({DOW[d.getDay()]})</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{formatTime(row.clockIn)}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {!row.clockOut ? (
                            <span className="text-status-red-text">--:--</span>
                          ) : formatTime(row.clockOut)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-secondary">{row.breakMinutes}分</span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{formatMinutes(row.workMinutes)}</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.overtimeMinutes && row.overtimeMinutes > 0 ? (
                            <span className="text-status-amber-text">{formatMinutes(row.overtimeMinutes)}</span>
                          ) : formatMinutes(row.overtimeMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right pr-4">
                          {hasPending ? (
                            <span className="text-2xs px-2 py-0.5 rounded bg-status-amber-bg text-status-amber-text">申請中</span>
                          ) : (
                            <button
                              onClick={() => openEdit(row)}
                              className="text-2xs text-primary hover:underline"
                            >
                              修正
                            </button>
                          )}
                        </td>
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
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-border/30">
              <h2 className="text-lg font-medium">勤怠修正申請</h2>
              <p className="text-sm text-secondary mt-0.5">
                {(() => {
                  const d = new Date(editTarget.date);
                  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`;
                })()}
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
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
                <label className="block text-sm text-secondary mb-1">退勤時間</label>
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
            </div>
            <div className="px-5 py-4 border-t border-border/30 flex justify-end gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-page transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={submitCorrection}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? '送信中...' : '申請する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
