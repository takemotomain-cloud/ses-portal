'use client';

import { useToast } from '@/components/ui/toast';

export default function RecruitProgressPage() {
  const { toast, ToastUI } = useToast();

  const cards = [
    {
      label: '応募数',
      value: '18名',
      diff: '+3 先月比',
      detail: '紹介: 8名 / 媒体: 5名 / リファラル: 3名 / 自社: 2名',
    },
    {
      label: '有効応募数',
      value: '14名',
      diff: '+2 先月比',
      detail: '紹介: 7名 / 媒体: 3名 / リファラル: 3名 / 自社: 1名',
    },
    {
      label: '内定承諾者',
      value: '2名',
      diff: null,
      detail: '長谷川 翼（エージェント）、佐野 美香（リファラル）',
    },
    {
      label: '内定打診中',
      value: '1名',
      diff: null,
      detail: '河合 陽子（エージェント）',
    },
    {
      label: '一次面接予定',
      value: '5名',
      diff: null,
      detail: '紹介: 3名 / 媒体: 1名 / リファラル: 1名',
    },
    {
      label: '最終面接予定',
      value: '3名',
      diff: null,
      detail: '紹介: 2名 / リファラル: 1名',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <ToastUI />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-medium text-[#1A1A1A]">2026年3月の進捗</h1>
        <button
          className="px-4 py-2 bg-[#1A1A1A] text-white text-sm rounded-lg hover:opacity-90 transition"
          onClick={() => toast('通知を送信しました')}
        >
          通知する
        </button>
      </div>

      {/* 6 cards in 2-col x 3-row grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5 bg-[#FFFFFF]">
            <div className="text-sm text-[#6B6B6B] mb-1">{card.label}</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-medium text-[#1A1A1A]">{card.value}</span>
              {card.diff && (
                <span className="text-sm text-green-600 font-medium">{card.diff}</span>
              )}
            </div>
            <div className="text-sm text-[#6B6B6B]">{card.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
