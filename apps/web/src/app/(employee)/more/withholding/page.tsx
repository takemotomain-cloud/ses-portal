/**
 * 源泉徴収票ページ
 *
 * UIモックのpage-withholdingを再現。
 * 年度別PDF一覧（タップでダウンロード）+ 最新年度の概要。
 *
 * Phase 1: 静的デモ。API連携後にGET /api/withholding/:yearを呼ぶ。
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface WithholdingItem {
  year: number;
  totalIncome: number;
  taxAmount: number;
  status: string;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function WithholdingPage() {
  const [withholdingData, setWithholdingData] = useState<WithholdingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await apiClient<WithholdingItem[]>('/withholding');
        if (!cancelled) setWithholdingData(res);
      } catch {
        if (!cancelled) setWithholdingData([]);
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

  if (withholdingData.length === 0) {
    return <div className="card p-10 text-center text-secondary">年末調整データはありません</div>;
  }

  const latest = withholdingData[0];

  return (
    <div className="space-y-6">
      {/* 最新年度の概要 */}
      <div className="card p-5">
        <div className="text-sm text-secondary mb-3">{latest.year}年分 源泉徴収票</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-page rounded-lg p-3">
            <div className="text-2xs text-secondary mb-0.5">支払金額</div>
            <div className="text-xl font-medium tabular-nums">{fmt(latest.totalIncome)}<span className="text-sm font-normal text-secondary">円</span></div>
          </div>
          <div className="bg-page rounded-lg p-3">
            <div className="text-2xs text-secondary mb-0.5">源泉徴収税額</div>
            <div className="text-xl font-medium tabular-nums">{fmt(latest.taxAmount)}<span className="text-sm font-normal text-secondary">円</span></div>
          </div>
        </div>
      </div>

      {/* 年度別一覧 */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">源泉徴収票一覧</h2>
        <div className="card p-0">
          {withholdingData.map((item, idx) => (
            <div
              key={item.year}
              className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-page transition-colors
                ${idx < withholdingData.length - 1 ? 'border-b border-border-light' : ''}`}
              onClick={() => alert(`${item.year}年分のPDFを表示（デモ）`)}
            >
              <div>
                <div className="text-md font-medium">{item.year}年分 給与所得の源泉徴収票</div>
                <div className="text-sm text-secondary mt-0.5">
                  支払金額 {fmt(item.totalIncome)}円 / 源泉徴収税額 {fmt(item.taxAmount)}円
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="badge badge-ok">PDF</span>
                <span className="text-lg text-secondary">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
