/**
 * 管理側 クライアント詳細ページ
 *
 * 基本情報・稼働メンバー・過去の取引履歴・提案メール履歴を表示。
 * サイドパネルから独立ページに変更し情報量に対応。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface ClientDetail {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  tradeFlow: string;
  tradeStartDate: string | null;
  corporateNumber?: string;
  invoiceNumber?: string;
  websiteUrl?: string;
  representName?: string;
  capital?: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  projectName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  contractPrice: number;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
}

interface ProposalHistory {
  id: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: string;
  employees: { id: string; name: string; initial: string }[];
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}時${String(d.getMinutes()).padStart(2, '0')}分`;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const { toast, ToastUI } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pastAssignments, setPastAssignments] = useState<Assignment[]>([]);
  const [proposals, setProposals] = useState<ProposalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'history' | 'proposals'>('members');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, assignRes, proposalRes] = await Promise.all([
        apiClient<ClientDetail>(`/clients/${clientId}`),
        apiClient<{ data: Assignment[] }>('/assignments?limit=200').catch(() => ({ data: [] as Assignment[] })),
        apiClient<ProposalHistory[]>(`/proposals/history?clientId=${clientId}`).catch(() => [] as ProposalHistory[]),
      ]);

      setClient(clientRes);
      setProposals(proposalRes);

      const clientAssigns = assignRes.data.filter((a) => a.employee && (a as any).clientId === clientId);
      // fallback: filter by checking if assignment belongs to this client
      const allAssigns = assignRes.data.filter((a) => {
        const cId = (a as any).clientId || (a as any).client?.id;
        return cId === clientId;
      });
      setAssignments(allAssigns.filter(a => a.status === 'active'));
      setPastAssignments(allAssigns.filter(a => a.status !== 'active'));
    } catch (e: any) {
      toast(e?.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="p-8 text-center text-sm text-secondary">読み込み中...</div>;
  if (!client) return <div className="p-8 text-center text-sm text-secondary">クライアントが見つかりません</div>;

  const sectionLabel = 'text-2xs text-secondary uppercase tracking-widest mb-2';
  const infoRow = 'flex justify-between py-2 border-b border-border/20 text-base';

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/clients')} className="text-secondary hover:text-primary text-sm">← 一覧</button>
          <h1 className="text-2xl font-medium">{client.name}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/admin/clients/${clientId}/edit`)} className="btn-outline text-sm py-2">編集</button>
          <button onClick={() => router.push('/admin/billing')} className="btn-outline text-sm py-2">請求書発行</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="card p-4 text-center">
          <div className="text-2xs text-secondary">稼働人数</div>
          <div className="text-2xl font-medium">{assignments.length}<span className="text-sm text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xs text-secondary">月間売上</div>
          <div className="text-2xl font-medium tabular-nums">
            {assignments.reduce((s, a) => s + (a.contractPrice || 0), 0) > 0
              ? <>{fmt(assignments.reduce((s, a) => s + (a.contractPrice || 0), 0))}<span className="text-sm text-secondary ml-1">円</span></>
              : '--'}
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xs text-secondary">取引開始</div>
          <div className="text-lg font-medium">{fmtDate(client.tradeStartDate)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xs text-secondary">提案送信数</div>
          <div className="text-2xl font-medium">{proposals.length}<span className="text-sm text-secondary ml-1">件</span></div>
        </div>
      </div>

      {/* Main Content: 2 Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Basic Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <div className={sectionLabel}>基本情報</div>
            <div className="space-y-0">
              {[
                ['担当者', client.contactPerson || '--'],
                ['メール', client.contactEmail || '--'],
                ['電話', client.contactPhone || '--'],
                ['住所', client.address || '--'],
                ['Webサイト', client.websiteUrl || '--'],
              ].map(([l, v]) => (
                <div key={l} className={infoRow}>
                  <span className="text-secondary text-sm">{l}</span>
                  <span className="text-sm text-right max-w-[60%] break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2">
          <div className="card p-0">
            {/* Tab Bar */}
            <div className="flex border-b border-border/30">
              {([
                { key: 'members', label: `稼働メンバー (${assignments.length})` },
                { key: 'history', label: `取引履歴 (${pastAssignments.length})` },
                { key: 'proposals', label: `提案履歴 (${proposals.length})` },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-3 text-sm transition-colors relative ${
                    activeTab === tab.key
                      ? 'text-primary font-medium'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-5">
              {/* 稼働メンバー */}
              {activeTab === 'members' && (
                assignments.length === 0 ? (
                  <div className="text-sm text-secondary py-4 text-center">稼働中のメンバーはいません</div>
                ) : (
                  <div className="space-y-0">
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-border/20">
                        <div>
                          <span className="text-base font-medium">{a.employee.lastName} {a.employee.firstName}</span>
                          <span className="text-xs text-secondary ml-2">{a.employee.employeeCode}</span>
                          <div className="text-xs text-secondary mt-0.5">{a.projectName || '--'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm tabular-nums">{a.contractPrice ? `${fmt(a.contractPrice)}円` : '--'}</div>
                          <div className="text-xs text-secondary">{fmtDate(a.startDate)}〜</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* 取引履歴 */}
              {activeTab === 'history' && (
                pastAssignments.length === 0 ? (
                  <div className="text-sm text-secondary py-4 text-center">過去の取引履歴はありません</div>
                ) : (
                  <div className="space-y-0">
                    {pastAssignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-border/20">
                        <div>
                          <span className="text-base font-medium">{a.employee.lastName} {a.employee.firstName}</span>
                          <div className="text-xs text-secondary mt-0.5">{a.projectName || '--'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm tabular-nums">{a.contractPrice ? `${fmt(a.contractPrice)}円` : '--'}</div>
                          <div className="text-xs text-secondary">{fmtDate(a.startDate)} 〜 {fmtDate(a.endDate)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* 提案履歴 */}
              {activeTab === 'proposals' && (
                proposals.length === 0 ? (
                  <div className="text-sm text-secondary py-4 text-center">提案履歴はありません</div>
                ) : (
                  <div className="space-y-0">
                    {proposals.map(p => (
                      <div key={p.id} className="py-3 border-b border-border/20">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{p.subject}</div>
                          <span className={`badge ${p.status === 'sent' ? 'badge-ok' : 'badge-warn'}`}>
                            {p.status === 'sent' ? '送信済' : p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-secondary">
                          <span>To: {p.toEmail}</span>
                          <span>{fmtDateTime(p.sentAt)}</span>
                        </div>
                        {p.employees.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {p.employees.map(e => (
                              <span key={e.id} className="bg-primary/8 text-primary rounded px-2 py-0.5 text-xs">
                                {e.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
