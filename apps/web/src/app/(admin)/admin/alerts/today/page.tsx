/**
 * 管理側 本日のアラート
 *
 * UIモックのpage-alert-todayを再現。
 * 出勤打刻未確認一覧 + 本日の欠勤 + 有給取得一覧。
 * 件数バッジ連動。
 */

'use client';

import { useState } from 'react';

const missedClockIn: { name: string; client: string; expectedTime: string; confirmed: boolean }[] = [];

const absences: { name: string; reason: string; since: string }[] = [];

const onLeave: { name: string; type: string; dates: string }[] = [];

export default function AlertsTodayPage() {
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());

  function confirmMissed(idx: number) {
    setConfirmedIds(prev => new Set([...prev, idx]));
  }

  const unconfirmedCount = missedClockIn.length - confirmedIds.size;

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">本日のアラート</h1>

      {/* 出勤打刻未確認 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-md font-medium">出勤打刻未確認</h2>
          <span className="text-sm text-secondary">{unconfirmedCount}件</span>
        </div>
        <div className="card p-0">
          {missedClockIn.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
          )}
          {missedClockIn.map((item, idx) => {
            const isConfirmed = confirmedIds.has(idx);
            return (
              <div key={idx} className={`flex items-center justify-between px-5 py-3.5 gap-3 transition-opacity ${isConfirmed ? 'opacity-40' : ''} ${idx < missedClockIn.length - 1 ? 'border-b border-border/20' : ''}`}>
                <div>
                  <div className="text-base font-medium">{item.name}</div>
                  <div className="text-sm text-secondary">{item.client} · 稼働開始 {item.expectedTime}</div>
                </div>
                {!isConfirmed ? (
                  <button onClick={() => confirmMissed(idx)} className="btn-outline text-sm py-1.5 px-3">確認済にする</button>
                ) : (
                  <span className="text-sm text-secondary">確認済</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 本日の欠勤 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-md font-medium">本日の欠勤</h2>
          <span className="text-sm text-secondary">{absences.length}名</span>
        </div>
        <div className="card p-0">
          {absences.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
          )}
          {absences.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <div className="text-base font-medium">{item.name}</div>
                <div className="text-sm text-secondary">{item.reason} · {item.since}〜</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 有給取得 */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-md font-medium">有給取得</h2>
          <span className="text-sm text-secondary">{onLeave.length}名</span>
        </div>
        <div className="card p-0">
          {onLeave.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
          )}
          {onLeave.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <div className="text-base font-medium">{item.name}</div>
                <div className="text-sm text-secondary">{item.type} · {item.dates}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
