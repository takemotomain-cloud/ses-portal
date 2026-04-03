'use client';

const rows = [
  { name: 'Green_SES_2026春', platform: 'Green', period: '2026年1月1日〜3月31日', job: 'SESエンジニア', apply: 10, valid: 7, first: 4, final: 2, offer: 1, accept: 1, cost: 800000, cpa: 800000 },
  { name: 'Green_インフラ_2026春', platform: 'Green', period: '2026年2月1日〜3月31日', job: 'インフラエンジニア', apply: 5, valid: 3, first: 1, final: 0, offer: 0, accept: 0, cost: 400000, cpa: null },
  { name: 'Wantedly_SES_通年', platform: 'Wantedly', period: '2025年10月1日〜2026年9月30日', job: 'SESエンジニア', apply: 8, valid: 5, first: 2, final: 1, offer: 0, accept: 0, cost: 600000, cpa: null },
  { name: 'Wantedly_インフラ_通年', platform: 'Wantedly', period: '2025年10月1日〜2026年9月30日', job: 'インフラエンジニア', apply: 2, valid: 1, first: 1, final: 0, offer: 0, accept: 0, cost: null, cpa: null },
];

const footer = { apply: 25, valid: 16, first: 8, final: 3, offer: 1, accept: 1, cost: 1800000, cpa: 1800000 };

function yen(n: number | null): string {
  if (n === null) return '--';
  return n.toLocaleString('ja-JP') + '円';
}

export default function RecruitCampaignPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">キャンペーンアナリティクス</h1>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select className="border border-border rounded px-3 py-1.5 text-sm bg-white">
          <option>全媒体</option>
          <option>Green</option>
          <option>Wantedly</option>
        </select>
        <select className="border border-border rounded px-3 py-1.5 text-sm bg-white">
          <option>全求人</option>
          <option>SESエンジニア</option>
          <option>インフラエンジニア</option>
        </select>
        <input type="date" className="border border-border rounded px-3 py-1.5 text-sm bg-white" />
        <input type="date" className="border border-border rounded px-3 py-1.5 text-sm bg-white" />
        <button className="px-4 py-1.5 text-sm bg-primary text-white rounded hover:opacity-90">検索</button>
        <button className="px-4 py-1.5 text-sm border border-border rounded hover:bg-gray-50">クリア</button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[1100px]" style={{ whiteSpace: 'nowrap' }}>
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">掲載名</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">媒体</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">掲載期間</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">求人</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">応募</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">有効</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">一次</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">最終</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">内定</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">承諾</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">掲載費</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">採用単価</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                <td className="px-4 py-2.5 text-base font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-base"><span className="badge badge-warn">{r.platform}</span></td>
                <td className="px-4 py-2.5 text-sm text-secondary">{r.period}</td>
                <td className="px-4 py-2.5 text-base">{r.job}</td>
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
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="px-4 py-2.5 text-base">合計</td>
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5"></td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.apply}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.valid}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.first}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.final}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.offer}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{footer.accept}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{yen(footer.cost)}</td>
              <td className="px-4 py-2.5 text-base text-right tabular-nums">{yen(footer.cpa)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
