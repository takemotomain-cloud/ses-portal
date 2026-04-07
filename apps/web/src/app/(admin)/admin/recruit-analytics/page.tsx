'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ------------------------------------------------------------------ */
/*  型定義                                                              */
/* ------------------------------------------------------------------ */

interface AnalyticsRow {
  source: string;
  apply: number;
  valid: number;
  first: number;
  final: number;
  offer: number;
  accept: number;
  cost: number;
  cpa: number | null;
}

function yen(n: number | null): string {
  if (n === null || n === undefined) return '--';
  return n.toLocaleString('ja-JP') + '円';
}

/* ------------------------------------------------------------------ */
/*  コンポーネント                                                      */
/* ------------------------------------------------------------------ */

export default function RecruitAnalyticsPage() {
  const { toast, ToastUI } = useToast();
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<AnalyticsRow[]>(`/candidates/analytics?year=${year}`);
      setRows(data);
    } catch {
      toast('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 合計行
  const footer = rows.reduce(
    (acc, r) => ({
      apply: acc.apply + r.apply,
      valid: acc.valid + r.valid,
      first: acc.first + r.first,
      final: acc.final + r.final,
      offer: acc.offer + r.offer,
      accept: acc.accept + r.accept,
      cost: acc.cost + r.cost,
    }),
    { apply: 0, valid: 0, first: 0, final: 0, offer: 0, accept: 0, cost: 0 },
  );
  const footerCpa = footer.accept > 0 ? Math.round(footer.cost / footer.accept) : null;

  return (
    <div>
      <ToastUI />
      <h1 className="text-2xl font-medium mb-5">アナリティクス（経路別）</h1>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          className="border border-border rounded px-3 py-1.5 text-sm bg-white"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        >
          {[2026, 2025, 2024].map(y => (
            <option key={y} value={y}>{y}年度</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[900px]" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">経路名</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">応募</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">有効応募</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">一次面接</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">最終面接</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">内定</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">承諾</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">合計コスト</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">採用単価</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-secondary">データはありません</td></tr>
              ) : rows.map(r => (
                <tr key={r.source} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{r.source}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{r.apply}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{r.valid}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{r.first}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{r.final}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{r.offer}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{r.accept}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{yen(r.cost)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{yen(r.cpa)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td className="px-4 py-2.5 text-base">合計</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.apply}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.valid}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.first}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.final}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.offer}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.accept}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{yen(footer.cost)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{yen(footerCpa)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
