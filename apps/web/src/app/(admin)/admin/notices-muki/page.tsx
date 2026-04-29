/**
 * 管理側 通知書（無期転換）
 *
 * 来月で入社6ヶ月を迎える有期雇用社員一覧 + 発行済み通知書一覧。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- types ---------- */
type MukiTarget = {
  name: string;
  code: string;
  type: string;
  hire: string;
  sixMonthDate: string;
  status: 'none' | 'draft' | 'sent';
};

type IssuedNotice = {
  id: string;
  name: string;
  status: 'draft' | 'sent';
  date: string;
  convertDate: string;
};

/* ---------- data ---------- */
const mukiTargets: MukiTarget[] = [];
const issuedNotices: IssuedNotice[] = [];

/* ---------- badge map ---------- */
const statusBadge: Record<string, { label: string; cls: string }> = {
  none: { label: '未発行', cls: 'badge-wait' },
  draft: { label: '下書き', cls: 'badge-wait' },
  sent: { label: '送付済', cls: 'badge-info' },
};

export default function AdminNoticesMukiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const filteredIssued = issuedNotices.filter((n) =>
    n.name.includes(search),
  );

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知書（無期転換）</h1>
        <button
          className="btn-primary text-sm py-2"
          onClick={() => router.push('/admin/notices-muki/new')}
        >
          新規発行
        </button>
      </div>

      {/* ---------- policy card ---------- */}
      <div className="card bg-[#FAFAFA] mb-6">
        <p className="text-sm leading-relaxed">
          基本方針：6ヶ月の有期雇用で採用した社員を、6ヶ月後に無期雇用へ転換する際に労働条件通知書を発行します。下記は来月で入社6ヶ月を迎える有期雇用社員の一覧です。
        </p>
      </div>

      {/* ---------- section 1: targets ---------- */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">
          来月で6ヶ月を迎える有期雇用社員
          <span className="ml-2 text-sm text-secondary font-normal">{mukiTargets.length}名</span>
        </h2>

        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                {['氏名', '社員番号', '雇用形態', '入社日', '6ヶ月経過日', '通知書', 'アクション'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mukiTargets.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="px-4 py-8 text-center text-sm text-secondary">
                      データはありません
                    </div>
                  </td>
                </tr>
              ) : (
                mukiTargets.map((t) => {
                  const st = statusBadge[t.status];
                  return (
                    <tr
                      key={t.code}
                      className="border-b border-border/20 hover:bg-[#FAFAF8]"
                    >
                      <td className="px-4 py-2.5 text-base font-medium">{t.name}</td>
                      <td className="px-4 py-2.5 text-base">{t.code}</td>
                      <td className="px-4 py-2.5 text-base">{t.type}</td>
                      <td className="px-4 py-2.5 text-base">{t.hire}</td>
                      <td className="px-4 py-2.5 text-base">{t.sixMonthDate}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {t.status === 'none' && (
                          <button onClick={() => toast('発行機能は今後実装予定です')} className="btn-primary text-xs py-1 px-2.5">発行する</button>
                        )}
                        {t.status === 'draft' && (
                          <button onClick={() => toast('送付機能は今後実装予定です')} className="btn-outline text-xs py-1 px-2.5">送付する</button>
                        )}
                        {t.status === 'sent' && (
                          <button onClick={() => window.print()} className="btn-outline text-xs py-1 px-2.5">PDF</button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- section 2: issued ---------- */}
      <div>
        <h2 className="text-lg font-medium mb-3">
          発行済み通知書
          <span className="ml-2 text-sm text-secondary font-normal">{filteredIssued.length}件</span>
        </h2>

        <div className="mb-4">
          <input
            type="text"
            placeholder="氏名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full max-w-xs"
          />
        </div>

        <div className="space-y-3">
          {filteredIssued.length === 0 ? (
            <div className="card px-4 py-8 text-center text-sm text-secondary">
              データはありません
            </div>
          ) : (
            filteredIssued.map((n) => {
              const st = statusBadge[n.status];
              return (
                <div key={n.id} className="card">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-base font-medium">{n.name}</div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-sm text-secondary">労働条件通知書（無期転換）</span>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      <span className="text-sm text-secondary">{n.date}</span>
                      <span className="text-sm text-secondary">転換日: {n.convertDate}</span>
                      {n.status === 'draft' && (
                        <button onClick={() => toast('送付機能は今後実装予定です')} className="btn-outline text-xs py-1 px-2.5">送付する</button>
                      )}
                      {n.status === 'sent' && (
                        <button onClick={() => window.print()} className="btn-outline text-xs py-1 px-2.5">PDF</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
