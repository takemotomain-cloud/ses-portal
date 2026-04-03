/**
 * 採用予算
 *
 * 年間予算 vs 実績。月別内訳。経路別の消化状況。
 */

'use client';

function fmt(n: number) { return n.toLocaleString(); }

export default function RecruitBudgetPage() {
  const annualBudget = 6000000;
  const spent = 2800000;
  const remaining = annualBudget - spent;
  const pct = Math.round(spent / annualBudget * 100);

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">予算</h1>

      {/* 年間サマリー */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-xs text-secondary">年間予算</div>
          <div className="text-2xl font-medium tabular-nums">{fmt(annualBudget)}<span className="text-sm font-normal text-secondary ml-1">円</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">消化額</div>
          <div className="text-2xl font-medium tabular-nums text-status-amber-text">{fmt(spent)}<span className="text-sm font-normal ml-1">円</span></div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
              <div className="h-full bg-status-amber-text rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-secondary">{pct}%</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">残予算</div>
          <div className="text-2xl font-medium tabular-nums text-status-green-text">{fmt(remaining)}<span className="text-sm font-normal ml-1">円</span></div>
        </div>
      </div>

      {/* 月別内訳 */}
      <h2 className="text-md font-medium mb-3">月別実績</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead><tr className="border-b border-border">
            {['月', 'エージェント', '求人媒体', 'リファラル', '合計'].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              ['2026年3月', 600000, 205000, 50000, 855000],
              ['2026年2月', 800000, 180000, 100000, 1080000],
              ['2026年1月', 400000, 165000, 50000, 615000],
              ['2025年12月', 200000, 50000, 0, 250000],
            ].map(row => (
              <tr key={row[0] as string} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                <td className="px-4 py-2.5 text-base font-medium">{row[0]}</td>
                {(row.slice(1) as number[]).map((v, i) => (
                  <td key={i} className={`px-4 py-2.5 text-base text-right tabular-nums ${i === 3 ? 'font-medium' : ''}`}>{fmt(v)}円</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
