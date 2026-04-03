/**
 * 賞与明細ページ
 *
 * UIモックのpage-bonusを再現。
 * 期切替 + 差引支給額 + 支給・控除の2カラム + 支給日。
 */

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

interface BonusData {
  earnings: [string, number][];
  deductions: [string, number][];
  paymentDate: string;
}

// プレースホルダーデータ
const PLACEHOLDER_DATA: Record<string, BonusData> = {
  '2025年 冬季賞与': {
    earnings: [['賞与額', 560000]],
    deductions: [
      ['健康保険', 32480],
      ['厚生年金', 51240],
      ['雇用保険', 3360],
      ['所得税', 60060],
    ],
    paymentDate: '2025年12月10日',
  },
  '2025年 夏季賞与': {
    earnings: [['賞与額', 520000]],
    deductions: [
      ['健康保険', 30160],
      ['厚生年金', 47580],
      ['雇用保険', 3120],
      ['所得税', 54320],
    ],
    paymentDate: '2025年6月10日',
  },
  '2024年 冬季賞与': {
    earnings: [['賞与額', 500000]],
    deductions: [
      ['健康保険', 29000],
      ['厚生年金', 45750],
      ['雇用保険', 3000],
      ['所得税', 51200],
    ],
    paymentDate: '2024年12月10日',
  },
  '2024年 夏季賞与': {
    earnings: [['賞与額', 480000]],
    deductions: [
      ['健康保険', 27840],
      ['厚生年金', 43920],
      ['雇用保険', 2880],
      ['所得税', 48960],
    ],
    paymentDate: '2024年6月10日',
  },
  '2023年 冬季賞与': {
    earnings: [['賞与額', 460000]],
    deductions: [
      ['健康保険', 26680],
      ['厚生年金', 42090],
      ['雇用保険', 2760],
      ['所得税', 46920],
    ],
    paymentDate: '2023年12月10日',
  },
  '2023年 夏季賞与': {
    earnings: [['賞与額', 440000]],
    deductions: [
      ['健康保険', 25520],
      ['厚生年金', 40260],
      ['雇用保険', 2640],
      ['所得税', 44880],
    ],
    paymentDate: '2023年6月10日',
  },
};

const BONUS_PERIODS = [
  '2023年 夏季賞与',
  '2023年 冬季賞与',
  '2024年 夏季賞与',
  '2024年 冬季賞与',
  '2025年 夏季賞与',
  '2025年 冬季賞与',
];

export default function BonusPage() {
  const [periodIdx, setPeriodIdx] = useState(BONUS_PERIODS.length - 1);
  const currentPeriod = BONUS_PERIODS[periodIdx];
  const data = PLACEHOLDER_DATA[currentPeriod] ?? null;

  const totalEarnings = data ? data.earnings.reduce((s, [, v]) => s + v, 0) : 0;
  const totalDeductions = data ? data.deductions.reduce((s, [, v]) => s + v, 0) : 0;
  const netBonus = totalEarnings - totalDeductions;

  const { toast, ToastUI } = useToast();

  function fmt(n: number) {
    return n.toLocaleString();
  }

  return (
    <div className="space-y-5">
      {/* 期切り替え */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setPeriodIdx(Math.max(periodIdx - 1, 0))}
          disabled={periodIdx <= 0}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-lg font-medium min-w-[160px] text-center">
          {currentPeriod}
        </span>
        <button
          onClick={() =>
            setPeriodIdx(Math.min(periodIdx + 1, BONUS_PERIODS.length - 1))
          }
          disabled={periodIdx >= BONUS_PERIODS.length - 1}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {!data ? (
        <div className="card p-10 text-center text-secondary">
          賞与データはありません
        </div>
      ) : (
        <>
          {/* 差引支給額 */}
          <div className="card p-5 text-center">
            <div className="text-sm text-secondary mb-1">差引支給額</div>
            <div className="text-4xl font-medium tabular-nums">
              ¥{fmt(netBonus)}
            </div>
          </div>

          {/* 支給・控除 2カラム */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 支給 */}
            <div className="card p-0">
              <div className="px-4 py-3 border-b border-border bg-status-green-bg/30">
                <span className="text-md font-semibold text-status-green-text">
                  支給
                </span>
              </div>
              <div className="px-4 py-2">
                {data.earnings.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-2 border-b border-border-light text-md"
                  >
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">{fmt(value)}円</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 mt-1 font-semibold text-md">
                  <span>支給合計</span>
                  <span className="tabular-nums">{fmt(totalEarnings)}円</span>
                </div>
              </div>
            </div>

            {/* 控除 */}
            <div className="card p-0">
              <div className="px-4 py-3 border-b border-border bg-status-red-bg/30">
                <span className="text-md font-semibold text-status-red-text">
                  控除
                </span>
              </div>
              <div className="px-4 py-2">
                {data.deductions.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-2 border-b border-border-light text-md"
                  >
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">{fmt(value)}円</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 mt-1 font-semibold text-md">
                  <span>控除合計</span>
                  <span className="tabular-nums">
                    {fmt(totalDeductions)}円
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 支給日 */}
          <div className="card px-4 py-3">
            <div className="text-xs text-secondary mb-1">支給日</div>
            <div className="text-sm font-medium">{data.paymentDate}</div>
          </div>

          {/* PDFダウンロード */}
          <button
            onClick={() => toast('PDF機能は今後追加予定です')}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            PDFダウンロード
          </button>
        </>
      )}
      <ToastUI />
    </div>
  );
}
