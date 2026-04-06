/**
 * 管理側 就業規則
 *
 * 統合HTMLプロトタイプのpage-admin-rulesを再現。
 * 現行版プレビュー + 改定履歴タブ + 編集・公開フロー。
 * 公開すると社員側にも反映される（API経由でwork_rulesテーブルを更新）。
 */

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

const rulesHistory: { version: string; date: string; author: string; memo: string }[] = [];

export default function AdminRulesPage() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const { toast, ToastUI } = useToast();

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">就業規則</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-outline text-sm py-2">PDFエクスポート</button>
          <button onClick={() => toast('就業規則はPDFアップロードで更新してください')} className="btn-primary text-sm py-2">編集する</button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">現行バージョン</div>
          <div className="text-3xl font-medium">--</div>
          <div className="text-xs text-secondary mt-0.5">--</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">章数</div>
          <div className="text-3xl font-medium">--</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">条文数</div>
          <div className="text-3xl font-medium">--</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">社員公開</div>
          <div className="text-3xl font-medium text-secondary">--</div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-border/40 mb-5">
        <button onClick={() => setActiveTab(0)} className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'}`}>
          現行版
        </button>
        <button onClick={() => setActiveTab(1)} className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'}`}>
          改定履歴
        </button>
      </div>

      {/* 現行版タブ */}
      {activeTab === 0 && (
        <div className="card p-5">
          <div className="text-sm text-secondary mb-4">就業規則のプレビューは社員側と同じアコーディオン形式で表示されます。「編集する」ボタンから章・条文の追加・変更が可能です。</div>
          <div className="p-4 bg-page rounded-lg text-sm text-secondary text-center">
            プレビューエリア（社員側の就業規則画面と同じ内容を表示）
          </div>
        </div>
      )}

      {/* 改定履歴タブ */}
      {activeTab === 1 && (
        <div className="card p-0">
          {rulesHistory.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
          ) : rulesHistory.map((item, idx) => (
            <div key={item.version} className={`flex items-center gap-3 px-5 py-3.5 ${idx < rulesHistory.length - 1 ? 'border-b border-border/20' : ''}`}>
              <div className="flex-1">
                <div className="text-base">
                  <span className="font-medium">{item.version}</span>
                  <span className="text-secondary ml-2">公開 — {item.memo}</span>
                </div>
                <div className="text-sm text-secondary mt-0.5">{item.date} · {item.author}</div>
              </div>
              <span className="badge badge-ok">公開済</span>
            </div>
          ))}
        </div>
      )}
      <ToastUI />
    </div>
  );
}
