/**
 * 管理側 商談ログ
 *
 * 名刺管理を軸に商談記録。名刺スキャナー（カメラ撮影→OCR→フォーム自動入力）付き。
 */

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

const demoDeals: { name: string; company: string; dept: string; email: string; logs: number; lastContact: string }[] = [];

export default function AdminDealsPage() {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const selected = selectedIdx !== null ? demoDeals[selectedIdx] : null;
  const { toast, ToastUI } = useToast();

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">商談ログ</h1>
        <div className="flex gap-2">
          <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline text-sm py-2">名刺スキャン</button>
          <button onClick={() => toast('この機能は現在準備中です')} className="btn-primary text-sm py-2">名刺を登録</button>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead><tr className="border-b border-border">
            {['氏名', '会社名', '部署', '商談件数', '最終連絡日'].map(h => (
              <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {demoDeals.length === 0 ? (
              <tr><td colSpan={5}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : demoDeals.map((d, idx) => (
              <tr key={idx} onClick={() => setSelectedIdx(idx)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer">
                <td className="px-4 py-2.5 text-base font-medium">{d.name}</td>
                <td className="px-4 py-2.5 text-base">{d.company}</td>
                <td className="px-4 py-2.5 text-base text-secondary">{d.dept}</td>
                <td className="px-4 py-2.5 text-base text-right">{d.logs}件</td>
                <td className="px-4 py-2.5 text-base text-secondary">{d.lastContact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedIdx(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary">{selected.company}</div>
              </div>
              <button onClick={() => setSelectedIdx(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">名刺情報</div>
                {[['部署', selected.dept], ['メール', selected.email], ['最終連絡', selected.lastContact]].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline flex-1 text-sm py-2">編集</button>
                <button onClick={() => toast('この機能は現在準備中です')} className="btn-primary flex-1 text-sm py-2">商談を記録</button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastUI />
    </div>
  );
}
