/**
 * 管理側 通知書（入社前）
 *
 * 採用内定通知書 + 労働条件通知書を人ごとにカード表示。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- types ---------- */
type Notice = {
  id: string;
  name: string;
  offer: { status: 'draft' | 'sent' | 'accepted'; date: string };
  labor: { status: 'draft' | 'sent' | 'accepted' | 'none'; date: string } | null;
};

/* ---------- data ---------- */
const notices: Notice[] = [];

/* ---------- badge map ---------- */
const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '下書き', cls: 'badge-wait' },
  sent: { label: '送付済', cls: 'badge-info' },
  accepted: { label: '承諾済', cls: 'badge-ok' },
  none: { label: '未発行', cls: 'badge-wait' },
};

export default function AdminNoticesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const filtered = notices.filter((n) => n.name.includes(search));

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知書（入社前）</h1>
        <button
          className="btn-primary text-sm py-2"
          onClick={() => router.push('/admin/notices/new')}
        >
          新規発行
        </button>
      </div>

      {/* ---------- search filter ---------- */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="氏名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full max-w-xs"
        />
        <span className="text-sm text-secondary">{filtered.length}名</span>
      </div>

      {/* ---------- list ---------- */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card px-4 py-8 text-center text-sm text-secondary">
            データはありません
          </div>
        ) : (
          filtered.map((n) => {
            const offerBadge = statusBadge[n.offer.status];
            const laborBadge = n.labor ? statusBadge[n.labor.status] : statusBadge['none'];

            return (
              <div key={n.id} className="card">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* person name */}
                  <div className="text-base font-bold min-w-[100px]">{n.name}</div>

                  {/* 採用内定通知書 */}
                  <div className="flex items-center gap-3 bg-[#FAFAFA] rounded-lg p-3">
                    <span className="text-sm">採用内定通知書</span>
                    <span className={`badge ${offerBadge.cls}`}>{offerBadge.label}</span>
                    <span className="text-xs text-secondary">{n.offer.date}</span>
                    {n.offer.status === 'draft' && (
                      <button onClick={() => toast('送付機能は今後実装予定です')} className="btn-outline text-xs py-1 px-2.5">送付する</button>
                    )}
                    {n.offer.status === 'sent' && (
                      <button onClick={() => window.print()} className="btn-outline text-xs py-1 px-2.5">PDF</button>
                    )}
                    {n.offer.status === 'accepted' && (
                      <button onClick={() => window.print()} className="btn-outline text-xs py-1 px-2.5">PDF</button>
                    )}
                  </div>

                  {/* 労働条件通知書 */}
                  <div className="flex items-center gap-3 bg-[#FAFAFA] rounded-lg p-3">
                    <span className="text-sm">労働条件通知書</span>
                    {n.labor ? (
                      <>
                        <span className={`badge ${laborBadge.cls}`}>{laborBadge.label}</span>
                        <span className="text-xs text-secondary">{n.labor.date}</span>
                        {n.labor.status === 'draft' && (
                          <button onClick={() => toast('送付機能は今後実装予定です')} className="btn-outline text-xs py-1 px-2.5">送付する</button>
                        )}
                        {n.labor.status === 'sent' && (
                          <button onClick={() => window.print()} className="btn-outline text-xs py-1 px-2.5">PDF</button>
                        )}
                        {n.labor.status === 'accepted' && (
                          <button onClick={() => window.print()} className="btn-outline text-xs py-1 px-2.5">PDF</button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-secondary">未発行</span>
                        <button onClick={() => toast('発行機能は今後実装予定です')} className="btn-primary text-xs py-1 px-2.5">発行する</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
