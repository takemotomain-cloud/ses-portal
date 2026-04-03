/**
 * 稼働情報ページ
 *
 * UIモックのpage-assignmentを再現。
 * 現在の稼働先詳細（単価・精算幅・還元率・勤務場所）+ 稼働ヒストリー。
 *
 * デザインルール:
 * - 金額はカンマ区切り全桁表示（M/K省略禁止）
 * - 日付は「○年○月○日」形式
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Assignment {
  clientName: string;
  projectName: string;
  contractPrice: number;
  settlementLower: number;
  settlementUpper: number;
  rewardRate: number;
  workLocation: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface AssignmentHistory {
  client: string;
  project: string;
  period: string;
  price: number;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function AssignmentPage() {
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [current, hist] = await Promise.allSettled([
          apiClient('/assignments/current'),
          apiClient('/assignments/history'),
        ]);
        if (!cancelled) {
          setCurrentAssignment(current.status === 'fulfilled' ? current.value as Assignment : null);
          setHistory(hist.status === 'fulfilled' ? hist.value as AssignmentHistory[] : []);
        }
      } catch {
        // both failed
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="card p-10 text-center text-secondary">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 現在の稼働 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-bold text-primary">現在の稼働先</h2>
          {currentAssignment && <span className="badge badge-ok">稼働中</span>}
        </div>

        {!currentAssignment ? (
          <div className="card p-10 text-center text-secondary">現在の稼働データはありません</div>
        ) : (
          <div className="card p-5 space-y-4">
            <div>
              <div className="text-lg font-semibold">{currentAssignment.clientName}</div>
              <div className="text-sm text-secondary mt-0.5">{currentAssignment.projectName}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-page rounded-lg p-3">
                <div className="text-2xs text-secondary mb-0.5">契約単価</div>
                <div className="text-xl font-medium tabular-nums">{fmt(currentAssignment.contractPrice)}<span className="text-sm font-normal text-secondary">円/月</span></div>
              </div>
              <div className="bg-page rounded-lg p-3">
                <div className="text-2xs text-secondary mb-0.5">還元率</div>
                <div className="text-xl font-medium">{currentAssignment.rewardRate}<span className="text-sm font-normal text-secondary">%</span></div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                ['精算幅', `${currentAssignment.settlementLower}h 〜 ${currentAssignment.settlementUpper}h`],
                ['勤務場所', currentAssignment.workLocation],
                ['契約期間', `${currentAssignment.startDate} 〜 ${currentAssignment.endDate}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-md border-b border-border-light pb-2 last:border-b-0 last:pb-0">
                  <span className="text-secondary">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 稼働ヒストリー */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">稼働ヒストリー</h2>
        {history.length === 0 ? (
          <div className="card p-10 text-center text-secondary">稼働ヒストリーはありません</div>
        ) : (
          <div className="card p-0">
            {history.map((item, idx) => (
              <div
                key={idx}
                className={`px-4 py-3.5 ${idx < history.length - 1 ? 'border-b border-border-light' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-md font-medium">{item.client}</span>
                  <span className="badge badge-wait">終了</span>
                </div>
                <div className="text-sm text-secondary">{item.project}</div>
                <div className="text-sm text-secondary mt-1">
                  {item.period}　単価 {fmt(item.price)}円
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
