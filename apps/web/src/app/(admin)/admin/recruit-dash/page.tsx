/**
 * 採用ダッシュボード
 *
 * KPI（応募数・面接数・内定数・入社数）+ パイプラインファネル + 月次推移。
 */

'use client';

export default function RecruitDashPage() {
  const kpis = [
    { label: '今月の応募', value: 0, sub: '--' },
    { label: '面接予定', value: 0, sub: '--' },
    { label: '内定出し', value: 0, sub: '--' },
    { label: '今月入社', value: 0, sub: '--' },
  ];

  const pipeline = [
    { stage: '応募', count: 0, color: 'bg-status-blue-bg', textColor: 'text-status-blue-text' },
    { stage: '書類選考', count: 0, color: 'bg-status-amber-bg', textColor: 'text-status-amber-text' },
    { stage: '面接', count: 0, color: 'bg-accent', textColor: 'text-accent-text' },
    { stage: '内定', count: 0, color: 'bg-status-green-bg', textColor: 'text-status-green-text' },
    { stage: '入社', count: 0, color: 'bg-status-green-bg', textColor: 'text-status-green-text' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">採用ダッシュボード</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-secondary">{k.label}</div>
            <div className="text-3xl font-medium">{k.value}</div>
            <div className="text-xs text-secondary mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <h2 className="text-md font-medium mb-3">採用パイプライン</h2>
      <div className="card p-5 mb-5">
        <div className="flex items-end gap-3 justify-center h-[200px]">
          {pipeline.map(p => (
            <div key={p.stage} className="flex flex-col items-center gap-2 flex-1">
              <span className="text-2xl font-medium">{p.count}</span>
              <div className={`w-full rounded-t-lg ${p.color}`} style={{ height: `${p.count > 0 ? (p.count / 12) * 150 : 0}px`, minHeight: '20px' }} />
              <span className="text-xs text-secondary">{p.stage}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-md font-medium mb-3">月次推移</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead><tr className="border-b border-border">
            {['月', '応募', '書類通過', '面接', '内定', '入社', '通過率'].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
