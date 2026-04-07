'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ------------------------------------------------------------------ */
/*  型定義                                                              */
/* ------------------------------------------------------------------ */

interface BudgetRow {
  id: string;
  fiscalYear: number;
  category: string;
  month: number;
  budget: number;
  actual: number;
}

type MonthlyData = [number, number, number, number, number, number, number, number, number, number, number, number];

interface BudgetGroup {
  label: string;
  category: string;
  budget: MonthlyData;
  actual: MonthlyData;
}

const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
const CATEGORY_LABELS: Record<string, string> = {
  agent: 'エージェント手数料',
  media: '媒体掲載費',
  referral: 'リファラル報酬',
};

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}

function sumRow(row: MonthlyData): number {
  return row.reduce((a, b) => a + b, 0);
}

function diffRow(budget: MonthlyData, actual: MonthlyData): MonthlyData {
  return budget.map((b, i) => b - actual[i]) as MonthlyData;
}

function totalRow(groups: BudgetGroup[], key: 'budget' | 'actual'): MonthlyData {
  const result: MonthlyData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const g of groups) {
    for (let i = 0; i < 12; i++) {
      result[i] += g[key][i];
    }
  }
  return result;
}

function DiffCell({ value }: { value: number }) {
  const cls = value < 0 ? 'text-status-red-text' : value > 0 ? 'text-status-green-text' : '';
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${cls}`} style={{ whiteSpace: 'nowrap' }}>
      {value < 0 ? `-${fmt(Math.abs(value))}` : fmt(value)}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/*  API データ → BudgetGroup[] 変換                                     */
/* ------------------------------------------------------------------ */

function toBudgetGroups(rows: BudgetRow[]): BudgetGroup[] {
  const catMap = new Map<string, BudgetGroup>();

  for (const r of rows) {
    if (!catMap.has(r.category)) {
      catMap.set(r.category, {
        label: CATEGORY_LABELS[r.category] || r.category,
        category: r.category,
        budget: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        actual: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      });
    }
    const g = catMap.get(r.category)!;
    // month 1-12 → index: month 4→0, 5→1, ..., 3→11
    const idx = r.month >= 4 ? r.month - 4 : r.month + 8;
    g.budget[idx] = r.budget;
    g.actual[idx] = r.actual;
  }

  // 固定順序
  const order = ['agent', 'media', 'referral'];
  const sorted: BudgetGroup[] = [];
  for (const cat of order) {
    if (catMap.has(cat)) sorted.push(catMap.get(cat)!);
  }
  // その他のカテゴリ
  for (const [cat, g] of catMap) {
    if (!order.includes(cat)) sorted.push(g);
  }
  return sorted;
}

/* ------------------------------------------------------------------ */
/*  コンポーネント                                                      */
/* ------------------------------------------------------------------ */

export default function RecruitBudgetPage() {
  const [year, setYear] = useState<number>(2026);
  const { toast, ToastUI } = useToast();
  const [groups, setGroups] = useState<BudgetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<BudgetRow[]>(`/candidates/budgets?year=${year}`);
      setGroups(toBudgetGroups(data));
    } catch {
      toast('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const totalBudget = totalRow(groups, 'budget');
  const totalActual = totalRow(groups, 'actual');
  const totalDiffArr = diffRow(totalBudget, totalActual);

  function renderValueRow(label: string, row: MonthlyData) {
    return (
      <tr className="border-b border-border/20 hover:bg-[#FAFAF8]">
        <td className="px-3 py-2 pl-8 sticky left-0 bg-white z-10 min-w-[180px]" style={{ whiteSpace: 'nowrap' }}>{label}</td>
        {row.map((v, i) => (
          <td key={i} className="px-3 py-2 text-right tabular-nums" style={{ whiteSpace: 'nowrap' }}>{fmt(v)}</td>
        ))}
        <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ whiteSpace: 'nowrap' }}>{fmt(sumRow(row))}</td>
      </tr>
    );
  }

  function renderDiffRow(budget: MonthlyData, actual: MonthlyData) {
    const diff = diffRow(budget, actual);
    const total = sumRow(budget) - sumRow(actual);
    return (
      <tr className="border-b border-border/20 hover:bg-[#FAFAF8]">
        <td className="px-3 py-2 pl-8 sticky left-0 bg-white z-10 min-w-[180px]" style={{ whiteSpace: 'nowrap' }}>差額</td>
        {diff.map((v, i) => (
          <DiffCell key={i} value={v} />
        ))}
        <DiffCell value={total} />
      </tr>
    );
  }

  return (
    <div>
      <ToastUI />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-medium">採用予算</h1>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value={2026}>2026年度</option>
          <option value={2025}>2025年度</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] sticky left-0 z-10 min-w-[180px]" style={{ whiteSpace: 'nowrap' }}>項目</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] min-w-[100px]" style={{ whiteSpace: 'nowrap' }}>{m}</th>
                ))}
                <th className="text-right text-xs text-secondary font-normal px-3 py-2.5 bg-[#FAFAFA] min-w-[100px]" style={{ whiteSpace: 'nowrap' }}>合計</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows key={group.category} group={group} renderValueRow={renderValueRow} renderDiffRow={renderDiffRow} />
              ))}

              {groups.length > 0 && (
                <>
                  <tr className="bg-page/50">
                    <td className="px-3 py-2 font-semibold sticky left-0 bg-page/50 z-10 min-w-[180px]" style={{ whiteSpace: 'nowrap' }} colSpan={14}>合計</td>
                  </tr>
                  {renderValueRow('予算', totalBudget)}
                  {renderValueRow('実績', totalActual)}
                  {renderDiffRow(totalBudget, totalActual)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add item */}
      <div className="flex items-center gap-3 mt-5">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="新しい項目名"
          className="border border-border rounded-md px-3 py-1.5 text-sm"
        />
        <button
          className="btn-outline text-sm py-1.5 px-4"
          onClick={async () => {
            if (newItem.trim()) {
              try {
                // 新規カテゴリの12ヶ月分を作成
                for (let m = 1; m <= 12; m++) {
                  await apiClient('/candidates/budgets', {
                    method: 'POST',
                    body: JSON.stringify({ fiscalYear: year, category: newItem.trim(), month: m, budget: 0, actual: 0 }),
                  });
                }
                toast(`「${newItem.trim()}」を追加しました`);
                setNewItem('');
                fetchBudgets();
              } catch {
                toast('追加に失敗しました');
              }
            }
          }}
        >
          項目追加
        </button>
      </div>

      {/* 計上定義 */}
      <div className="card p-5 mt-5">
        <h2 className="text-md font-medium mb-3">計上定義</h2>
        <ul className="space-y-1.5 text-sm text-secondary">
          <li><span className="font-medium text-primary">媒体:</span> キャンペーン開始月に費用全額計上</li>
          <li><span className="font-medium text-primary">エージェント:</span> 入社月に手数料計上</li>
          <li><span className="font-medium text-primary">自社HP:</span> コスト0</li>
          <li><span className="font-medium text-primary">リファラル:</span> 入社月に固定額計上</li>
        </ul>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  renderValueRow,
  renderDiffRow,
}: {
  group: BudgetGroup;
  renderValueRow: (label: string, row: MonthlyData) => React.ReactNode;
  renderDiffRow: (budget: MonthlyData, actual: MonthlyData) => React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-page/50">
        <td className="px-3 py-2 font-semibold sticky left-0 bg-page/50 z-10 min-w-[180px]" style={{ whiteSpace: 'nowrap' }} colSpan={14}>{group.label}</td>
      </tr>
      {renderValueRow('予算', group.budget)}
      {renderValueRow('実績', group.actual)}
      {renderDiffRow(group.budget, group.actual)}
    </>
  );
}
