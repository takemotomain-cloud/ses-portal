/**
 * 届出・書類ページ
 *
 * 各種届出の申請・提出状況を管理。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const documentTypes = [
  { id: 1, name: '住所変更届', desc: '引越し等による住所変更', status: null },
  { id: 2, name: '通勤経路変更届', desc: '通勤手段・経路の変更', status: null },
  { id: 3, name: '扶養異動届', desc: '扶養家族の追加・削除', status: null },
  { id: 4, name: '結婚届', desc: '結婚に伴う届出', status: null },
  { id: 5, name: '改姓届', desc: '姓の変更', status: null },
  { id: 6, name: '口座変更届', desc: '給与振込口座の変更', status: null },
];

const history: { id: number; name: string; date: string; status: string }[] = [];

export default function DocumentsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<typeof documentTypes[0] | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page">‹</button>
        <h1 className="text-lg font-bold text-primary">届出・書類</h1>
      </div>

      {/* 届出一覧 */}
      <div className="card p-0">
        <ul>
          {documentTypes.map((doc) => (
            <li
              key={doc.id}
              onClick={() => setSelected(doc)}
              className="flex items-center justify-between px-4 py-3.5 border-b border-border-light last:border-b-0 cursor-pointer hover:bg-page transition-colors"
            >
              <div>
                <p className="text-md text-primary font-medium">{doc.name}</p>
                <p className="text-sm text-secondary mt-0.5">{doc.desc}</p>
              </div>
              <span className="text-secondary text-lg">›</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 提出履歴 */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">提出履歴</h2>
        {history.length === 0 ? (
          <div className="card p-10 text-center text-secondary">提出履歴はありません</div>
        ) : (
          <div className="card p-0">
            <ul>
              {history.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-4 py-3.5 border-b border-border-light last:border-b-0">
                  <div>
                    <p className="text-md text-primary">{item.name}</p>
                    <p className="text-sm text-secondary mt-0.5">{item.date}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-status-green-bg text-status-green-text">{item.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 届出モーダル */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <div className="sm:hidden flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-border" /></div>
            <h3 className="text-lg font-bold text-primary mb-2">{selected.name}</h3>
            <p className="text-sm text-secondary mb-5">{selected.desc}</p>
            <p className="text-sm text-secondary mb-6">この届出の申請フォームは現在準備中です。人事・総務部へ直接ご連絡ください。</p>
            <button onClick={() => setSelected(null)} className="w-full py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
