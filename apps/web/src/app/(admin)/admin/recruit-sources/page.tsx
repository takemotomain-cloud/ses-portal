/**
 * 応募経路管理
 *
 * 各エージェント・媒体ごとの応募数・採用数・コスト管理。
 */

'use client';

const sources: { name: string; type: string; apps: number; hires: number; cost: number; cpa: number; active: boolean }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

export default function RecruitSourcesPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">応募経路</h1>
        <button className="btn-primary text-sm py-2">経路を追加</button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr className="border-b border-border">
            {['経路名', '種別', '応募数', '採用数', '費用', '採用単価', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {sources.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : sources.map(s => (
              <tr key={s.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                <td className="px-4 py-2.5 text-base font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-base"><span className="badge badge-wait">{s.type}</span></td>
                <td className="px-4 py-2.5 text-base text-right">{s.apps}名</td>
                <td className="px-4 py-2.5 text-base text-right font-medium">{s.hires}名</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(s.cost)}円</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{s.cpa > 0 ? fmt(s.cpa) + '円' : '--'}</td>
                <td className="px-4 py-2.5"><span className={`badge ${s.active ? 'badge-ok' : 'badge-wait'}`}>{s.active ? '有効' : '停止'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
