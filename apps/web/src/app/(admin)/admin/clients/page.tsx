/**
 * 管理側 クライアント一覧
 *
 * HTMLプロトタイプ仕様を再現。
 * KPI行 + テーブル一覧 + 行クリック→詳細パネル（稼働メンバー・取引履歴）。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface Client {
  id: string;
  name: string;
  industry: string;
  monthlyRevenue: number;
  memberCount: number;
  avgUnitPrice: number;
  startDate: string;
  contact: string;
  activeMembers: { name: string; role: string; since: string }[];
  history: { period: string; description: string }[];
}

function fmt(n: number) { return n.toLocaleString(); }

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? clients.find(c => c.id === selectedId) : null;
  const { toast, ToastUI } = useToast();

  const fetchClients = useCallback(async () => {
    try {
      const res = await apiClient<{ data: any[] }>('/clients');
      setClients(
        res.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          industry: c.industry || '',
          monthlyRevenue: c.monthlyRevenue || 0,
          memberCount: c.memberCount || 0,
          avgUnitPrice: c.memberCount ? Math.round(c.monthlyRevenue / c.memberCount) : 0,
          startDate: c.tradeStartDate ? new Date(c.tradeStartDate).toLocaleDateString('ja-JP') : '--',
          contact: c.contactPerson || '--',
          activeMembers: (c.activeMembers || []).map((m: any) => ({
            name: m.name,
            role: m.project,
            since: m.since ? new Date(m.since).toLocaleDateString('ja-JP') : '--',
          })),
          history: [],
        })),
      );
    } catch {
      // 認証エラー等はapiClientが処理
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const totalClients = clients.length;
  const activeClients = clients.length;
  const maxRevenue = clients.length > 0 ? Math.max(...clients.map(c => c.monthlyRevenue)) : 0;
  const avgPeriod = 0;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">クライアント</h1>
        <button onClick={() => router.push('/admin/clients/new')} className="btn-primary text-sm py-2">新規クライアント登録</button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="card p-4">
          <div className="text-xs text-secondary mb-1">取引先数</div>
          <div className="text-2xl font-medium">{totalClients || 0}<span className="text-sm text-secondary ml-1">社</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary mb-1">稼働中</div>
          <div className="text-2xl font-medium">{activeClients || 0}<span className="text-sm text-secondary ml-1">社</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary mb-1">最大取引先売上</div>
          <div className="text-2xl font-medium tabular-nums">{maxRevenue ? fmt(maxRevenue) : '--'}<span className="text-sm text-secondary ml-1">円/月</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary mb-1">平均取引期間</div>
          <div className="text-2xl font-medium">{avgPeriod || '--'}<span className="text-sm text-secondary ml-1">年</span></div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">クライアント名</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">月間売上</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">人数</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">平均単価</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">取引開始</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">アクション</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : clients.map(c => (
              <tr key={c.id} onClick={() => setSelectedId(c.id)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors">
                <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(c.monthlyRevenue)}円</td>
                <td className="px-4 py-2.5 text-base text-right">{c.memberCount}名</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{fmt(c.avgUnitPrice)}円</td>
                <td className="px-4 py-2.5 text-base text-right text-secondary">{c.startDate}</td>
                <td className="px-4 py-2.5">
                  <button onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }} className="btn-outline text-xs py-1 px-2">詳細</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            {/* Panel Header */}
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.industry}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Stats Grid (3 col) */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-page rounded-lg p-3 text-center">
                  <div className="text-2xs text-secondary">稼働人数</div>
                  <div className="text-2xl font-medium">{selected.memberCount}</div>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <div className="text-2xs text-secondary">月間売上</div>
                  <div className="text-lg font-medium tabular-nums">{fmt(selected.monthlyRevenue)}</div>
                </div>
                <div className="bg-page rounded-lg p-3 text-center">
                  <div className="text-2xs text-secondary">取引開始</div>
                  <div className="text-base font-medium">{selected.startDate}</div>
                </div>
              </div>

              {/* 基本情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">基本情報</div>
                {[['担当者', selected.contact], ['業種', selected.industry]].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>

              {/* 現在の稼働メンバー */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">現在の稼働メンバー</div>
                {selected.activeMembers.length === 0 ? (
                  <div className="text-sm text-secondary py-2">データはありません</div>
                ) : selected.activeMembers.map((m, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span>{m.name}<span className="text-secondary text-sm ml-2">{m.role}</span></span>
                    <span className="text-secondary text-sm">{m.since}〜</span>
                  </div>
                ))}
              </div>

              {/* 過去の取引履歴 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">過去の取引履歴</div>
                {selected.history.length === 0 ? (
                  <div className="text-sm text-secondary py-2">データはありません</div>
                ) : selected.history.map((h, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{h.period}</span><span>{h.description}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button onClick={() => router.push(`/admin/clients/${selected.id}/edit`)} className="btn-outline flex-1 text-sm py-2">編集</button>
                <button onClick={() => router.push('/admin/billing')} className="btn-outline flex-1 text-sm py-2">請求書発行</button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastUI />
    </div>
  );
}
