'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type AnalyticsRow = {
  name: string;
  apply: number;
  valid: number;
  first: number;
  final: number;
  offer: number;
  accept: number;
};

type Card = {
  label: string;
  value: string;
  diff: string | null;
  detail: string;
};

function getFiscalYearLabel(date = new Date()) {
  const year = date.getMonth() + 1 >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  return { year, label: `${year}年度` };
}

function sumRows(rows: AnalyticsRow[]) {
  return rows.reduce(
    (acc, row) => ({
      apply: acc.apply + row.apply,
      valid: acc.valid + row.valid,
      first: acc.first + row.first,
      final: acc.final + row.final,
      offer: acc.offer + row.offer,
      accept: acc.accept + row.accept,
    }),
    { apply: 0, valid: 0, first: 0, final: 0, offer: 0, accept: 0 },
  );
}

function diffText(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return null;
  return `${diff > 0 ? '+' : ''}${diff}件`;
}

export default function RecruitProgressPage() {
  const fiscal = useMemo(() => getFiscalYearLabel(), []);
  const [currentRows, setCurrentRows] = useState<AnalyticsRow[]>([]);
  const [previousRows, setPreviousRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [current, previous] = await Promise.all([
          apiClient<AnalyticsRow[]>(`/candidates/analytics?year=${fiscal.year}`),
          apiClient<AnalyticsRow[]>(`/candidates/analytics?year=${fiscal.year - 1}`),
        ]);
        if (!alive) return;
        setCurrentRows(current);
        setPreviousRows(previous);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'データの取得に失敗しました');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fiscal.year]);

  const cards = useMemo<Card[]>(() => {
    const current = sumRows(currentRows);
    const previous = sumRows(previousRows);
    const acceptanceRate = current.apply > 0 ? Math.round((current.accept / current.apply) * 100) : 0;
    const previousAcceptanceRate = previous.apply > 0 ? Math.round((previous.accept / previous.apply) * 100) : 0;
    const offerRate = current.final > 0 ? Math.round((current.offer / current.final) * 100) : 0;
    const previousOfferRate = previous.final > 0 ? Math.round((previous.offer / previous.final) * 100) : 0;

    return [
      {
        label: '応募数',
        value: `${current.apply}件`,
        diff: diffText(current.apply, previous.apply),
        detail: '採用経路を問わない総応募数です',
      },
      {
        label: '有効応募数',
        value: `${current.valid}件`,
        diff: diffText(current.valid, previous.valid),
        detail: '書類選考以降へ進んだ候補者数です',
      },
      {
        label: '一次面接到達',
        value: `${current.first}件`,
        diff: diffText(current.first, previous.first),
        detail: '一次面接まで進んだ候補者数です',
      },
      {
        label: '最終面接到達',
        value: `${current.final}件`,
        diff: diffText(current.final, previous.final),
        detail: '最終面接まで進んだ候補者数です',
      },
      {
        label: '内定率',
        value: `${offerRate}%`,
        diff: current.final > 0 || previous.final > 0 ? `${offerRate - previousOfferRate > 0 ? '+' : ''}${offerRate - previousOfferRate}pt` : null,
        detail: '最終面接到達者に対する内定出し率です',
      },
      {
        label: '承諾率',
        value: `${acceptanceRate}%`,
        diff: current.apply > 0 || previous.apply > 0 ? `${acceptanceRate - previousAcceptanceRate > 0 ? '+' : ''}${acceptanceRate - previousAcceptanceRate}pt` : null,
        detail: '応募数に対する内定承諾率です',
      },
    ];
  }, [currentRows, previousRows]);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-medium text-[#1A1A1A]">{fiscal.label}の進捗</h1>
      </div>

      {error && (
        <div className="card p-4 mb-4 text-sm text-status-red-text">{error}</div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-secondary">読み込み中...</div>
      ) : cards.length === 0 ? (
        <div className="card p-10 text-center text-secondary">データはありません</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="card p-5 bg-[#FFFFFF]">
              <div className="text-sm text-[#6B6B6B] mb-1">{card.label}</div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-medium text-[#1A1A1A]">{card.value}</span>
                {card.diff && (
                  <span className={`text-sm font-medium ${card.diff.startsWith('-') ? 'text-status-red-text' : 'text-green-600'}`}>
                    {card.diff}
                  </span>
                )}
              </div>
              <div className="text-sm text-[#6B6B6B]">{card.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
