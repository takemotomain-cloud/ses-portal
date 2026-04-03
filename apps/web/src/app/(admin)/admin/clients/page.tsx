/**
 * 管理側 クライアント一覧
 *
 * UIモックのpage-clientsを再現。
 * テーブル一覧 + 行クリック→詳細パネル（稼働メンバー・取引履歴）。
 */

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

const demoClients: { id: string; name: string; industry: string; contact: string; members: number; revenue: number; startDate: string }[] = [];

function fmt(n: number) { return n.toLocaleString(); }

export default function AdminClientsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? demoClients.find(c => c.id === selectedId) : null;
  const { toast, ToastUI } = useToast();

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">クライアント</h1>
        <button onClick={() => toast('この機能は現在準備中です')} className="btn-primary text-sm py-2">新規クライアント登録</button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              {['会社名', '業種', '担当者', '稼働人数', '月間売上', '取引開始'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demoClients.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoClients.map(c => (
              <tr key={c.id} onClick={() => setSelectedId(c.id)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors">
                <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-base">{c.industry}</td>
                <td className="px-4 py-2.5 text-base">{c.contact}</td>
                <td className="px-4 py-2.5 text-base text-right">{c.members}名</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(c.revenue)}円</td>
                <td className="px-4 py-2.5 text-base text-secondary">{c.startDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 詳細パネル */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.industry}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-page rounded-lg p-3 text-center">
                  <div className="text-2xs text-secondary">稼働人数</div>
                  <div className="text-2xl font-medium">{selected.members}</div>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <div className="text-2xs text-secondary">月間売上</div>
                  <div className="text-lg font-medium tabular-nums">{fmt(selected.revenue)}</div>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <div className="text-2xs text-secondary">取引開始</div>
                  <div className="text-base font-medium">{selected.startDate}</div>
                </div>
              </div>
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">基本情報</div>
                {[['担当者', selected.contact], ['業種', selected.industry]].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline flex-1 text-sm py-2">編集</button>
                <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline flex-1 text-sm py-2">請求書発行</button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastUI />
    </div>
  );
}
