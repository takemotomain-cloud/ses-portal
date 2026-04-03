'use client';

import { useToast } from '@/components/ui/toast';

export default function RecruitDashPage() {
  const { toast, ToastUI } = useToast();

  const interviews = [
    {
      interviewer: '山本 浩二',
      name: '田村 健一',
      stage: '一次面接',
      datetime: '2026年4月1日 10時00分',
      position: 'SESエンジニア',
      source: 'エージェント',
      sourceBadge: 'badge-info',
      confirmed: '確認済',
      confirmedBadge: 'badge-ok',
    },
    {
      interviewer: '田辺 恵子',
      name: '岸田 美優',
      stage: '最終面接',
      datetime: '2026年4月1日 13時00分',
      position: 'インフラエンジニア',
      source: '媒体',
      sourceBadge: 'badge-warn',
      confirmed: '未確認',
      confirmedBadge: 'badge-wait',
    },
    {
      interviewer: '山本 浩二',
      name: '中島 大樹',
      stage: '一次面接',
      datetime: '2026年4月1日 16時00分',
      position: 'SESエンジニア',
      source: 'リファラル',
      sourceBadge: 'badge-ok',
      confirmed: '確認済',
      confirmedBadge: 'badge-ok',
    },
  ];

  const proposals = [
    {
      date: '2026年3月28日',
      status: '書類選考',
      statusBadge: 'badge-info',
      name: '松岡 涼太',
      isNew: true,
      position: 'SESエンジニア',
      agent: 'テックエージェント',
    },
    {
      date: '2026年3月29日',
      status: '書類選考',
      statusBadge: 'badge-info',
      name: '柳澤 真帆',
      isNew: true,
      position: 'インフラエンジニア',
      agent: 'ITキャリア',
    },
    {
      date: '2026年3月25日',
      status: '一次面接待ち',
      statusBadge: 'badge-warn',
      name: '吉村 翔',
      isNew: false,
      position: 'SESエンジニア',
      agent: 'テックエージェント',
    },
    {
      date: '2026年3月20日',
      status: '最終面接待ち',
      statusBadge: 'badge-warn',
      name: '河合 陽子',
      isNew: false,
      position: 'SESエンジニア',
      agent: 'エンジニアパートナーズ',
    },
    {
      date: '2026年3月15日',
      status: '内定承諾',
      statusBadge: 'badge-ok',
      name: '長谷川 翼',
      isNew: false,
      position: 'インフラエンジニア',
      agent: 'テックエージェント',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <ToastUI />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-medium text-[#1A1A1A]">採用ダッシュボード</h1>
        <button
          className="px-4 py-2 bg-[#1A1A1A] text-white text-sm rounded-lg hover:opacity-90 transition"
          onClick={() => toast('通知を送信しました')}
        >
          通知する
        </button>
      </div>

      {/* Section 1: 明日の面接予定 */}
      <h2 className="text-md font-medium text-[#1A1A1A] mb-3">明日の面接予定</h2>
      <div className="card p-0 overflow-x-auto mb-6">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['面接官', '氏名', 'ステージ', '日時', '応募求人', '経路', '前日確認'].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs text-[#6B6B6B] font-normal px-4 py-2.5 bg-[#FAFAFA] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {interviews.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.interviewer}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className="text-blue-600 cursor-pointer hover:underline">{row.name}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.stage}</td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.datetime}</td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.position}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${row.sourceBadge}`}>{row.source}</span>
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${row.confirmedBadge}`}>{row.confirmed}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section 2: 最新エージェント提案（5件） */}
      <h2 className="text-md font-medium text-[#1A1A1A] mb-3">最新エージェント提案（5件）</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['応募日', 'ステータス', '候補者名', '希望職種', 'エージェント', '詳細'].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs text-[#6B6B6B] font-normal px-4 py-2.5 bg-[#FAFAFA] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proposals.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`badge ${row.statusBadge}`}>{row.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">
                  {row.name}
                  {row.isNew && (
                    <span className="ml-2 badge badge-danger text-xs">New</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.position}</td>
                <td className="px-4 py-3 text-sm text-[#1A1A1A] whitespace-nowrap">{row.agent}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <button
                    className="px-3 py-1 text-xs border border-border rounded-md hover:bg-gray-50 transition text-[#1A1A1A]"
                    onClick={() => toast(`${row.name}の詳細を表示します`)}
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
