/**
 * 社員側 勤怠画面（API連携版）
 *
 * APIから月次勤怠データを取得。データがなければ空表示。
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  status: string;
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

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

export default function AttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient<AttendanceRecord[]>(`/attendance/${year}/${month}`)
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [year, month]);

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
          <table className="w-full min-w-[540px]">
            <thead>
              <tr className="border-b border-border">
                {['日付', '出勤', '退勤', '休憩', '稼働', '残業'].map(h => (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
