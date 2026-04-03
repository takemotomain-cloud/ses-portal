'use client';

import { useState } from 'react';

function toast(message: string) {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText =
    'position:fixed;bottom:24px;right:24px;background:#333;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;transition:opacity .3s';
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

type AgentSource = { name: string; fee: string; memo: string };
type MediaSource = { name: string; cost: string; memo: string };
type OtherSource = { name: string; typeName: string; typeBadge: string; cost: string; memo: string };

const agentSources: AgentSource[] = [
  { name: 'テックエージェント', fee: '理論年収の35%', memo: '主力エージェント' },
  { name: 'ITキャリア', fee: '理論年収の30%', memo: 'インフラ系に強い' },
  { name: 'エンジニアパートナーズ', fee: '理論年収の35%', memo: '' },
];

const mediaSources: MediaSource[] = [
  { name: 'Green', cost: '1,200,000円', memo: 'エンジニア向け' },
  { name: 'Wantedly', cost: '600,000円', memo: 'カジュアル面談経由' },
];

const otherSources: OtherSource[] = [
  { name: '社員紹介', typeName: 'リファラル', typeBadge: 'badge-ok', cost: '1名あたり100,000円', memo: '入社時支給' },
  { name: '自社HP', typeName: '自社', typeBadge: 'badge-wait', cost: '0円', memo: '' },
];

export default function RecruitSourcesPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">応募経路管理</h1>
        <button
          className="btn-primary text-sm py-2"
          onClick={() => toast('経路追加ダイアログを開きます')}
        >
          経路を追加
        </button>
      </div>

      {/* エージェント（紹介） */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">エージェント（紹介）</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[700px]" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr className="border-b border-border">
                {['経路名', 'タイプ', '手数料', 'メモ', '編集'].map((h) => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentSources.map((s) => (
                <tr key={s.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{s.name}</td>
                  <td className="px-4 py-2.5"><span className="badge badge-info">紹介</span></td>
                  <td className="px-4 py-2.5 text-sm">{s.fee}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{s.memo || '—'}</td>
                  <td className="px-4 py-2.5">
                    <button
                      className="btn-outline text-xs py-1 px-3"
                      onClick={() => toast(`${s.name}の編集画面を開きます`)}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 媒体 */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">媒体</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr className="border-b border-border">
                {['経路名', 'タイプ', '掲載費合計', 'メモ'].map((h) => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mediaSources.map((s) => (
                <tr key={s.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{s.name}</td>
                  <td className="px-4 py-2.5"><span className="badge badge-warn">媒体</span></td>
                  <td className="px-4 py-2.5 text-sm tabular-nums">{s.cost}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{s.memo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* その他 */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">その他</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr className="border-b border-border">
                {['経路名', 'タイプ', 'コスト', 'メモ'].map((h) => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {otherSources.map((s) => (
                <tr key={s.name} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2.5 text-base font-medium">{s.name}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${s.typeBadge}`}>{s.typeName}</span></td>
                  <td className="px-4 py-2.5 text-sm tabular-nums">{s.cost}</td>
                  <td className="px-4 py-2.5 text-sm text-secondary">{s.memo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
