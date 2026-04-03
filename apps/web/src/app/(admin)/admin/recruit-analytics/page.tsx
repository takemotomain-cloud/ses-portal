'use client';

const rows = [
  { name: 'テックエージェント', apply: 24, valid: 20, first: 14, final: 8, offer: 5, accept: 4, cost: 5600000, cpa: 1400000 },
  { name: 'ITキャリア', apply: 12, valid: 9, first: 6, final: 3, offer: 2, accept: 1, cost: 1500000, cpa: 1500000 },
  { name: 'エンジニアパートナーズ', apply: 8, valid: 6, first: 4, final: 2, offer: 1, accept: 1, cost: 1400000, cpa: 1400000 },
  { name: 'Green', apply: 15, valid: 10, first: 5, final: 2, offer: 1, accept: 1, cost: 1200000, cpa: 1200000 },
  { name: 'Wantedly', apply: 10, valid: 6, first: 3, final: 1, offer: 0, accept: 0, cost: 600000, cpa: null },
  { name: '社員紹介', apply: 6, valid: 5, first: 4, final: 3, offer: 2, accept: 2, cost: 200000, cpa: 100000 },
  { name: '自社HP', apply: 4, valid: 2, first: 1, final: 0, offer: 0, accept: 0, cost: 0, cpa: null },
];

const footer = { apply: 79, valid: 58, first: 37, final: 19, offer: 11, accept: 9, cost: 10500000, cpa: 1166667 };

function yen(n: number | null): string {
  if (n === null) return '--';
  return n.toLocaleString('ja-JP') + '円';
}

export default function RecruitAnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">アナリティクス（経路別）</h1>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select className="border border-border rounded px-3 py-1.5 text-sm bg-white">
          <option>全求人</option>
          <option>SESエンジニア</option>
          <option>インフラエンジニア</option>
        </select>
        <select className="border border-border rounded px-3 py-1.5 text-sm bg-white">
          <option>全期間</option>
          <option>過去3ヶ月</option>
          <option>過去6ヶ月</option>
          <option>過去1年</option>
        </select>
        <button className="px-4 py-1.5 text-sm bg-primary text-white rounded hover:opacity-90">検索</button>
        <button className="px-4 py-1.5 text-sm border border-border rounded hover:bg-gray-50">クリア</button>
      </div>

      {/* Table */}
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
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                <td className="px-4 py-2.5 text-base font-medium">{r.name}</td>
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
