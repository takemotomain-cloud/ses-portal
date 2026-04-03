/**
 * 採用アナリティクス
 *
 * 採用プロセスの分析指標。通過率・所要日数・経路別効果。
 */

'use client';

export default function RecruitAnalyticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">アナリティクス</h1>

      {/* 全体KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: '平均採用日数', value: '32', unit: '日', sub: '応募→入社' },
          { label: '書類通過率', value: '66.7', unit: '%', sub: '8/12名' },
          { label: '面接通過率', value: '40.0', unit: '%', sub: '2/5名' },
          { label: '内定承諾率', value: '100', unit: '%', sub: '2/2名' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-secondary">{k.label}</div>
            <div className="text-3xl font-medium">{k.value}<span className="text-sm font-normal text-secondary ml-1">{k.unit}</span></div>
            <div className="text-xs text-secondary mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 経路別効果 */}
      <h2 className="text-md font-medium mb-3">経路別 採用効率</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="border-b border-border">
            {['経路', '応募', '採用', '通過率', '平均日数', '採用単価'].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              ['社員紹介', 4, 2, '50.0%', '18日', '100,000円'],
              ['テックエージェント', 5, 2, '40.0%', '28日', '600,000円'],
              ['Green', 8, 1, '12.5%', '35日', '350,000円'],
              ['ITキャリア', 3, 1, '33.3%', '42日', '800,000円'],
            ].map(row => (
              <tr key={row[0] as string} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                <td className="px-4 py-2.5 text-base font-medium">{row[0]}</td>
                <td className="px-4 py-2.5 text-base text-right">{row[1]}名</td>
                <td className="px-4 py-2.5 text-base text-right font-medium">{row[2]}名</td>
                <td className="px-4 py-2.5 text-base text-right">{row[3]}</td>
                <td className="px-4 py-2.5 text-base text-right">{row[4]}</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{row[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
