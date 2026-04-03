/**
 * 採用 月次進捗
 *
 * 月別の採用目標 vs 実績。進捗バー付き。
 */

'use client';

export default function RecruitProgressPage() {
  const months: { month: string; target: number; actual: number; apps: number; interviews: number; offers: number }[] = [];

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">月次進捗</h1>

      <div className="space-y-3">
        {months.length === 0 && (
          <div className="card px-4 py-8 text-center text-sm text-secondary">データはありません</div>
        )}
        {months.map(m => {
          const pct = m.target > 0 ? Math.round(m.actual / m.target * 100) : 0;
          const isAchieved = m.actual >= m.target;
          return (
            <div key={m.month} className="card p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="text-lg font-medium">{m.month}</div>
                <span className={`badge ${isAchieved ? 'badge-ok' : 'badge-warn'}`}>
                  {isAchieved ? '目標達成' : `残 ${m.target - m.actual}名`}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2.5 bg-border/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isAchieved ? 'bg-status-green-text' : 'bg-status-amber-text'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-base font-medium min-w-[60px] text-right">{m.actual} / {m.target}名</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-page rounded-lg p-2">
                  <div className="text-2xs text-secondary">応募</div>
                  <div className="text-lg font-medium">{m.apps}</div>
                </div>
                <div className="bg-page rounded-lg p-2">
                  <div className="text-2xs text-secondary">面接</div>
                  <div className="text-lg font-medium">{m.interviews}</div>
                </div>
                <div className="bg-page rounded-lg p-2">
                  <div className="text-2xs text-secondary">内定</div>
                  <div className="text-lg font-medium">{m.offers}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
