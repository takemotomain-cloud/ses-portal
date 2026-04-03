'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

function fmt(n: number) {
  return n.toLocaleString();
}

type MonthlyData = [number, number, number, number, number, number, number, number, number, number, number, number];

interface BudgetGroup {
  label: string;
  budget: MonthlyData;
  actual: MonthlyData;
}

const DATA_2026: BudgetGroup[] = [
  {
    label: 'エージェント手数料',
    budget: [500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000],
    actual: [700000, 350000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: '媒体掲載費',
    budget: [200000, 0, 200000, 0, 200000, 0, 200000, 0, 200000, 0, 200000, 0],
    actual: [800000, 0, 600000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    label: 'リファラル報酬',
    budget: [50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000],
    actual: [100000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

const DATA_2025: BudgetGroup[] = [
  {
    label: 'エージェント手数料',
    budget: [400000, 400000, 400000, 400000, 400000, 400000, 400000, 400000, 400000, 400000, 400000, 400000],
    actual: [400000, 300000, 500000, 200000, 450000, 350000, 400000, 300000, 500000, 250000, 400000, 350000],
  },
  {
    label: '媒体掲載費',
    budget: [150000, 0, 150000, 0, 150000, 0, 150000, 0, 150000, 0, 150000, 0],
    actual: [150000, 0, 200000, 0, 100000, 0, 150000, 0, 180000, 0, 150000, 0],
  },
  {
    label: 'リファラル報酬',
    budget: [50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000],
    actual: [0, 50000, 0, 0, 100000, 0, 50000, 0, 0, 50000, 0, 0],
  },
];

const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];

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

export default function RecruitBudgetPage() {
  const [year, setYear] = useState<number>(2026);
  const { toast, ToastUI } = useToast();
  const [newItem, setNewItem] = useState('');

  const groups = year === 2026 ? DATA_2026 : DATA_2025;

  const totalBudget = totalRow(groups, 'budget');
  const totalActual = totalRow(groups, 'actual');
  const totalDiff = diffRow(totalBudget, totalActual);

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

      {/* 12-month table */}
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
              <GroupRows key={group.label} group={group} renderValueRow={renderValueRow} renderDiffRow={renderDiffRow} />
            ))}

            {/* 合計 group */}
            <tr className="bg-page/50">
              <td className="px-3 py-2 font-semibold sticky left-0 bg-page/50 z-10 min-w-[180px]" style={{ whiteSpace: 'nowrap' }} colSpan={14}>合計</td>
            </tr>
            {renderValueRow('予算', totalBudget)}
            {renderValueRow('実績', totalActual)}
            {renderDiffRow(totalBudget, totalActual)}
          </tbody>
        </table>
      </div>

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
          onClick={() => {
            if (newItem.trim()) {
              toast(`「${newItem.trim()}」を追加しました`);
              setNewItem('');
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
