'use client';

import { useToast } from '@/components/ui/toast';

export default function RecruitProgressPage() {
  const { toast, ToastUI } = useToast();

  const cards: { label: string; value: string; diff: string | null; detail: string }[] = [];

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
      {cards.length === 0 ? (
        <div className="card p-10 text-center text-secondary">データはありません</div>
      ) : (
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
      )}
    </div>
  );
}
