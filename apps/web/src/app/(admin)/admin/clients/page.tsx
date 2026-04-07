/**
 * 管理側 クライアント一覧
 *
 * HTMLプロトタイプ仕様を再現。
 * KPI行 + テーブル一覧 + 行クリック→詳細パネル（稼働メンバー・取引履歴）。
 *
 * クライアントデータは GET /api/clients から取得。
 * 稼働メンバー数は GET /api/assignments から算出。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/** API レスポンスのクライアント型 */
interface ApiClient {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  tradeFlow: string;
  tradeStartDate: string | null;
}

/** API レスポンスのアサイン型 */
interface ApiAssignment {
  id: string;
  employeeId: string;
  clientId: string;
  projectName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
  client: { id: string; name: string };
}

/** 画面表示用のクライアント型 */
interface Client {
  id: string;
  name: string;
  industry: string;
  monthlyRevenue: number;
  memberCount: number;
  avgUnitPrice: number;
  startDate: string;
  contact: string;
}

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, ToastUI } = useToast();

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      // クライアントとアサインメントを並行取得
      const [clientRes, assignRes] = await Promise.all([
        apiClient<{ data: ApiClient[]; total: number; page: number; limit: number; totalPages: number }>('/clients?limit=200'),
        apiClient<{ data: ApiAssignment[] }>('/assignments?limit=200').catch(() => ({ data: [] as ApiAssignment[] })),
      ]);

      const assignments = assignRes.data;

      // クライアントごとの稼働中アサインを集計
      const activeAssignmentsByClient = new Map<string, ApiAssignment[]>();
      for (const a of assignments) {
        if (a.status === 'active') {
          const list = activeAssignmentsByClient.get(a.clientId) || [];
          list.push(a);
          activeAssignmentsByClient.set(a.clientId, list);
        }
      }

      setClients(
        clientRes.data.map((c) => {
          const clientAssignments = activeAssignmentsByClient.get(c.id) || [];
          const memberCount = clientAssignments.length;

          return {
            id: c.id,
            name: c.name,
            industry: c.industry || '',
            monthlyRevenue: 0,
            memberCount,
            avgUnitPrice: 0,
            startDate: c.tradeStartDate
              ? (() => { const d = new Date(c.tradeStartDate); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; })()
              : '--',
            contact: c.contactPerson || '--',
          };
        }),
      );
    } catch (e: any) {
      toast(e?.message || 'クライアント一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.memberCount > 0).length;
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
            {loading ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : clients.map(c => (
              <tr key={c.id} onClick={() => router.push(`/admin/clients/${c.id}`)} className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors">
                <td className="px-4 py-2.5 text-base font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{c.monthlyRevenue ? `${fmt(c.monthlyRevenue)}円` : '--'}</td>
                <td className="px-4 py-2.5 text-base text-right">{c.memberCount}名</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{c.avgUnitPrice ? `${fmt(c.avgUnitPrice)}円` : '--'}</td>
                <td className="px-4 py-2.5 text-base text-right text-secondary">{c.startDate}</td>
                <td className="px-4 py-2.5">
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/admin/clients/${c.id}`); }} className="btn-outline text-xs py-1 px-2">詳細</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ToastUI />
    </div>
  );
}
