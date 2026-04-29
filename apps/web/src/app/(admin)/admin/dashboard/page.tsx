/**
 * 管理画面 ダッシュボード
 *
 * UIモックのpage-dashboardを再現する。
 * エリア別比較テーブルのみ。KPIカードなし。
 */

'use client';

import { useState } from 'react';

export default function AdminDashboard() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">ダッシュボード</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="btn-outline py-1.5 px-3 text-sm">&lt;</button>
          <span className="text-lg font-medium min-w-[120px] text-center">
            {year}年{month}月
          </span>
          <button onClick={() => changeMonth(1)} className="btn-outline py-1.5 px-3 text-sm">&gt;</button>
        </div>
      </div>

      {/* エリア別テーブル */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal p-3 bg-page/50" />
              <th className="text-right text-xs text-secondary font-normal p-3 bg-page/50">東京エリア</th>
              <th className="text-right text-xs text-secondary font-normal p-3 bg-page/50">大阪エリア</th>
              <th className="text-right text-xs text-secondary font-normal p-3 bg-page/50">名古屋エリア</th>
              <th className="text-right text-xs text-secondary font-normal p-3 bg-page/50">全体</th>
            </tr>
          </thead>
          <tbody className="text-base">
            {[
              { label: '月間売上', values: ['--', '--', '--', '--'] },
              { label: '粗利', values: ['--', '--', '--', '--'] },
              { label: '粗利率', values: ['--', '--', '--', '--'] },
              { label: '平均単価', values: ['--', '--', '--', '--'] },
              { label: '稼働率', values: ['--', '--', '--', '--'] },
            ].map((row) => (
              <tr key={row.label} className="border-b border-border/30 hover:bg-page/30">
                <td className="p-3 font-medium">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className={`p-3 text-right tabular-nums ${i === row.values.length - 1 ? 'bg-page/50 font-medium' : ''}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
