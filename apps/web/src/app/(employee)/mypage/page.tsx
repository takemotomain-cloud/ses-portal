/**
 * マイページ ホーム
 *
 * 社員がログイン後に最初に表示されるページ。
 * アラートバナー + シフト確認 + 打刻エリア + クイックアクション + お知らせ。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { LinkedText } from '@/components/ui/linked-text';

/* ---- 型定義 ---- */

interface Notice {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  metadata?: { editId?: string; type?: string } | null;
  isRead: boolean;
  createdAt: string;
}

interface MissedClock {
  id: string;
  workDate: string;
  clockIn: string | null;
}

interface MyAlerts {
  missedClocks: MissedClock[];
  shiftUnconfirmed: boolean;
  expenseMissing: boolean;
  attendanceGaps: { date: string }[];
}

interface MyPageSummary {
  notices: Notice[];
  today: { clockIn: string | null; clockOut: string | null };
  alerts: MyAlerts;
}

interface ShiftDay {
  day: number;
  isWorkDay: boolean;
  startTime: string;
}

/* ---- ヘルパー ---- */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days === 0) return '本日';
  if (days === 1) return '昨日';
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

function fmtAlertDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function getDayOfWeek(ym: string, day: number): string {
  const [y, m] = ym.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, day).getDay()];
}

function isWeekendDay(ym: string, day: number): boolean {
  const [y, m] = ym.split('-').map(Number);
  const dow = new Date(y, m - 1, day).getDay();
  return dow === 0 || dow === 6;
}

/* ---- コンポーネント ---- */

export default function MyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [now, setNow] = useState(new Date());
  const [clockStatus, setClockStatus] = useState<'idle' | 'clocked_in'>('idle');
  const [clockMessage, setClockMessage] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  // 異議関連
  const [showObjection, setShowObjection] = useState(false);
  const [objectionReason, setObjectionReason] = useState('');
  const [submittingObjection, setSubmittingObjection] = useState(false);
  const [objectedEditIds, setObjectedEditIds] = useState<Set<string>>(new Set());

  // アラート
  const [alerts, setAlerts] = useState<MyAlerts | null>(null);

  // シフト確認
  const [showShiftConfirm, setShowShiftConfirm] = useState(false);
  const [showCustomShift, setShowCustomShift] = useState(false);
  const [customDays, setCustomDays] = useState<ShiftDay[]>([]);
  const [shiftSaving, setShiftSaving] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 初期表示に必要なデータをまとめて取得
  useEffect(() => {
    apiClient<MyPageSummary>('/attendance/mypage-summary')
      .then((summary) => {
        setNotices(summary.notices);
        setClockStatus(summary.today.clockIn && !summary.today.clockOut ? 'clocked_in' : 'idle');
        setAlerts(summary.alerts);
        if (summary.alerts.shiftUnconfirmed) {
          setShowShiftConfirm(true);
        }
      }).catch(() => {
        setNotices([]);
      });
  }, []);

  // シフト「いいえ」→ カスタム日設定の初期化
  const initCustomDays = useCallback(() => {
    const ym = getCurrentYearMonth();
    const days = getDaysInMonth(ym);
    const result: ShiftDay[] = [];
    for (let d = 1; d <= days; d++) {
      result.push({
        day: d,
        isWorkDay: !isWeekendDay(ym, d),
        startTime: '09:00',
      });
    }
    setCustomDays(result);
    setShowCustomShift(true);
  }, []);

  // シフト確認: はい
  async function handleShiftYes() {
    setShiftSaving(true);
    try {
      await apiClient('/attendance/shift/confirm', {
        method: 'POST',
        body: JSON.stringify({ yearMonth: getCurrentYearMonth(), isStandard: true }),
      });
      setShowShiftConfirm(false);
      setAlerts(prev => prev ? { ...prev, shiftUnconfirmed: false } : prev);
    } catch {
      // エラー時は何もしない
    } finally {
      setShiftSaving(false);
    }
  }

  // シフト確認: カスタム送信
  async function handleShiftCustomSubmit() {
    setShiftSaving(true);
    try {
      await apiClient('/attendance/shift/confirm', {
        method: 'POST',
        body: JSON.stringify({
          yearMonth: getCurrentYearMonth(),
          isStandard: false,
          customDays,
        }),
      });
      setShowShiftConfirm(false);
      setShowCustomShift(false);
      setAlerts(prev => prev ? { ...prev, shiftUnconfirmed: false } : prev);
    } catch {
      // エラー時は何もしない
    } finally {
      setShiftSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-secondary text-sm">読み込み中...</p>
      </div>
    );
  }

  const ym = getCurrentYearMonth();

  return (
    <div className="space-y-6">

      {/* ============================================================ */}
      {/*  アラートバナー                                                */}
      {/* ============================================================ */}
      {alerts && (
        <div className="space-y-2">
          {/* 打刻漏れ */}
          {alerts.missedClocks.map(mc => (
            <div
              key={mc.id}
              onClick={() => router.push('/attendance')}
              className="bg-card border border-border/40 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-page transition-colors active:opacity-80"
            >
              <span className="text-[11px] font-bold text-white rounded px-2 py-0.5 flex-shrink-0" style={{ background: '#e8380d' }}>未打刻</span>
              <p className="flex-1 text-[13px] text-primary min-w-0">
                {fmtAlertDate(mc.workDate)}の退勤打刻がありません
              </p>
              <span className="text-xs text-secondary flex-shrink-0">修正申請 ›</span>
            </div>
          ))}

          {/* 交通費（定期券）未申請 */}
          {alerts.expenseMissing && (
            <div
              onClick={() => router.push('/mypage/expense')}
              className="bg-card border border-border/40 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-page transition-colors active:opacity-80"
            >
              <span className="text-[11px] font-bold text-white rounded px-2 py-0.5 flex-shrink-0" style={{ background: '#e8380d' }}>未申請</span>
              <p className="flex-1 text-[13px] text-primary min-w-0">定期券の申請はお済みですか？</p>
              <span className="text-xs text-secondary flex-shrink-0">申請する ›</span>
            </div>
          )}

          {/* 勤怠漏れ */}
          {alerts.attendanceGaps.length > 0 && (
            <div
              onClick={() => router.push('/attendance')}
              className="bg-card border border-border/40 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-page transition-colors active:opacity-80"
            >
              <span className="text-[11px] font-bold text-white rounded px-2 py-0.5 flex-shrink-0" style={{ background: '#e8380d' }}>未入力</span>
              <p className="flex-1 text-[13px] text-primary min-w-0">
                先月の勤怠に{alerts.attendanceGaps.length}日分の未入力があります
              </p>
              <span className="text-xs text-secondary flex-shrink-0">確認する ›</span>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  シフト確認カード                                               */}
      {/* ============================================================ */}
      {showShiftConfirm && !showCustomShift && (
        <div className="card p-5">
          <h3 className="text-md font-bold text-primary mb-2">今月のシフト確認</h3>
          <p className="text-sm text-secondary mb-4">今月の稼働は土日祝の休みですか？</p>
          <div className="flex gap-3">
            <button
              onClick={handleShiftYes}
              disabled={shiftSaving}
              className="flex-1 py-3 rounded-lg bg-primary text-white text-md font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35"
            >
              {shiftSaving ? '登録中...' : 'はい'}
            </button>
            <button
              onClick={initCustomDays}
              disabled={shiftSaving}
              className="flex-1 py-3 rounded-lg border border-border text-primary text-md font-medium transition-colors hover:bg-page disabled:opacity-35"
            >
              いいえ
            </button>
          </div>
        </div>
      )}

      {/* カスタムシフト登録UI */}
      {showCustomShift && (
        <div className="card p-0">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-md font-bold text-primary">シフト登録</h3>
            <p className="text-xs text-secondary mt-0.5">稼働日と開始時間を設定してください</p>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border sticky top-0 bg-white z-10">
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">日付</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">曜日</th>
                  <th className="text-center text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">稼働</th>
                  <th className="text-left text-xs text-secondary font-normal px-4 py-2 bg-[#FAFAFA]">開始時間</th>
                </tr>
              </thead>
              <tbody>
                {customDays.map((d, idx) => {
                  const dow = getDayOfWeek(ym, d.day);
                  const weekend = isWeekendDay(ym, d.day);
                  const dowColor = dow === '日' ? 'text-status-red-text' : dow === '土' ? 'text-blue-500' : '';
                  return (
                    <tr key={d.day} className={`border-b border-border/10 ${weekend ? 'bg-gray-50/60' : ''}`}>
                      <td className="px-4 py-1.5 text-sm tabular-nums">{now.getMonth() + 1}/{d.day}</td>
                      <td className={`px-4 py-1.5 text-sm ${dowColor}`}>{dow}</td>
                      <td className="px-4 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={d.isWorkDay}
                          onChange={() => {
                            const next = [...customDays];
                            next[idx] = { ...next[idx], isWorkDay: !next[idx].isWorkDay };
                            setCustomDays(next);
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        {d.isWorkDay ? (
                          <input
                            type="time"
                            value={d.startTime}
                            onChange={(e) => {
                              const next = [...customDays];
                              next[idx] = { ...next[idx], startTime: e.target.value };
                              setCustomDays(next);
                            }}
                            className="border border-border rounded px-2 py-0.5 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-secondary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-border flex gap-3">
            <button
              onClick={() => { setShowCustomShift(false); }}
              className="flex-1 py-3 rounded-lg border border-border text-primary text-md font-medium transition-colors hover:bg-page"
            >
              戻る
            </button>
            <button
              onClick={handleShiftCustomSubmit}
              disabled={shiftSaving}
              className="flex-1 py-3 rounded-lg bg-primary text-white text-md font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35"
            >
              {shiftSaving ? '登録中...' : '確定'}
            </button>
          </div>
        </div>
      )}

      {/* 打刻エリア */}
      <div className="card p-0">
        <div className="text-center py-7 px-5">
          <p className="text-sm text-secondary mb-1">
            {`${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${['日','月','火','水','木','金','土'][now.getDay()]})`}
          </p>
          <p className="text-clock font-extralight tracking-wider text-primary tabular-nums mb-5">
            {now.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>

          {(user as any)?.employeeStatus === 'resigned' ? (
            <div className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full mb-2 bg-border-light text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              退職済み
            </div>
          ) : (
            <>
              <div className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full mb-5 ${
                clockStatus === 'clocked_in'
                  ? 'bg-status-green-bg text-status-green-text'
                  : 'bg-border-light text-secondary'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  clockStatus === 'clocked_in' ? 'bg-status-green-text' : 'bg-secondary'
                }`} />
                {clockStatus === 'clocked_in' ? '出勤中' : '未出勤'}
              </div>

              {clockMessage && (
                <p className="text-sm text-status-green-text mb-3">{clockMessage}</p>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={async () => {
                    try {
                      await apiClient('/attendance/clock-in', { method: 'POST' });
                      setClockStatus('clocked_in');
                      setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に出勤しました`);
                    } catch {
                      setClockStatus('clocked_in');
                      setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に出勤しました`);
                    }
                    setTimeout(() => setClockMessage(null), 3000);
                  }}
                  disabled={clockStatus === 'clocked_in'}
                  className="flex-1 max-w-[140px] py-3 rounded-lg bg-primary text-white text-md font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35"
                >
                  出勤
                </button>
                <button
                  onClick={async () => {
                    try {
                      await apiClient('/attendance/clock-out', { method: 'POST' });
                      setClockStatus('idle');
                      setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に退勤しました`);
                    } catch {
                      setClockStatus('idle');
                      setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に退勤しました`);
                    }
                    setTimeout(() => setClockMessage(null), 3000);
                  }}
                  disabled={clockStatus === 'idle'}
                  className="flex-1 max-w-[140px] py-3 rounded-lg border border-border text-primary text-md font-medium transition-colors hover:bg-page disabled:opacity-35"
                >
                  退勤
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* お知らせ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-bold text-primary">お知らせ</h2>
          <button
            onClick={() => router.push('/notifications')}
            className="text-sm text-secondary hover:text-primary transition-colors"
          >
            すべて見る
          </button>
        </div>
        <div className="card p-0">
          {notices.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">
              お知らせはありません
            </div>
          ) : (
            <ul>
              {notices.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  onClick={() => {
                    setSelectedNotice(item);
                    if (!item.isRead) {
                      apiClient(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => {});
                      setNotices(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
                    }
                  }}
                  className="flex items-start gap-3 px-4 py-3.5 border-b border-border-light last:border-b-0
                             cursor-pointer hover:bg-page transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-colors ${
                      !item.isRead ? 'bg-status-red-text' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-md text-primary font-medium truncate">{item.title}</p>
                    <p className="text-sm text-secondary mt-0.5 truncate">{item.body}</p>
                  </div>
                  <span className="text-sm text-secondary flex-shrink-0">{timeAgo(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* お知らせ詳細モーダル */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          onClick={() => setSelectedNotice(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-primary">{selectedNotice.title}</h3>
              <button
                onClick={() => setSelectedNotice(null)}
                className="text-secondary hover:text-primary text-xl leading-none flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            <span className="inline-block text-xs text-secondary bg-page px-2 py-0.5 rounded mb-4">
              {timeAgo(selectedNotice.createdAt)}
            </span>
            <div className="text-md text-primary leading-relaxed">
              <LinkedText text={selectedNotice.body} />
            </div>
            {selectedNotice.imageUrl && (
              <div className="mt-4">
                <img
                  src={`${selectedNotice.imageUrl}`}
                  alt="添付画像"
                  className="w-full rounded-lg border border-border"
                />
              </div>
            )}

            {/* 異議ありボタン（管理者修正通知の場合のみ） */}
            {selectedNotice.metadata?.type === 'attendance_edit' && selectedNotice.metadata?.editId && (
              <div className="mt-4 border-t border-border pt-4">
                {objectedEditIds.has(selectedNotice.metadata.editId) ? (
                  <div className="text-sm text-status-amber-text font-medium text-center py-2">
                    異議申し立て済み
                  </div>
                ) : showObjection ? (
                  <div className="space-y-3">
                    <textarea
                      value={objectionReason}
                      onChange={e => setObjectionReason(e.target.value)}
                      placeholder="異議の理由を入力してください"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowObjection(false); setObjectionReason(''); }}
                        className="flex-1 py-2 rounded-lg border border-border text-sm text-secondary hover:bg-page"
                      >キャンセル</button>
                      <button
                        disabled={!objectionReason.trim() || submittingObjection}
                        onClick={async () => {
                          setSubmittingObjection(true);
                          try {
                            await apiClient(`/attendance/admin-edit/${selectedNotice.metadata!.editId}/object`, {
                              method: 'POST',
                              body: JSON.stringify({ reason: objectionReason.trim() }),
                            });
                            setObjectedEditIds(prev => new Set(prev).add(selectedNotice.metadata!.editId!));
                            setShowObjection(false);
                            setObjectionReason('');
                          } catch {
                            // エラー時は何もしない
                          } finally {
                            setSubmittingObjection(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-lg bg-status-red-text text-white text-sm font-medium hover:bg-status-red-text/90 disabled:opacity-50"
                      >{submittingObjection ? '送信中...' : '異議を送信'}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowObjection(true)}
                    className="w-full py-2.5 rounded-lg border-2 border-status-red-text text-status-red-text text-sm font-medium hover:bg-status-red-bg transition-colors"
                  >
                    異議あり
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => { setSelectedNotice(null); setShowObjection(false); setObjectionReason(''); }}
              className="mt-4 w-full py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
