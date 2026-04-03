/**
 * キャンペーン分析
 *
 * 採用広告キャンペーンごとの効果測定。インプレッション・クリック・応募・コスト。
 */

'use client';

const campaigns: { name: string; platform: string; period: string; impressions: number; clicks: number; apps: number; cost: number; status: string }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

export default function RecruitCampaignPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">キャンペーン分析</h1>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead><tr className="border-b border-border">
            {['キャンペーン名', '媒体', '期間', 'インプレッション', 'クリック', '応募', '費用', 'CPA', ''].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={9}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : campaigns.map(c => {
              const ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(1) : '0';
              const cpa = c.apps > 0 ? Math.round(c.cost / c.apps) : 0;
              return (
                <tr key={c.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-base">{c.platform}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{c.period}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(c.impressions)}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(c.clicks)}<span className="text-xs text-secondary ml-1">({ctr}%)</span></td>
                  <td className="px-4 py-2.5 text-base text-right font-medium">{c.apps}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(c.cost)}円</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{cpa > 0 ? fmt(cpa) + '円' : '--'}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${c.status === 'active' ? 'badge-ok' : 'badge-wait'}`}>{c.status === 'active' ? '実施中' : '終了'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
