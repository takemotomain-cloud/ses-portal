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
  postalCode?: string;
  websiteUrl?: string;
  representName?: string;
  establishedDate?: string;
  capital?: string;
  billingEmail?: string;
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

interface DealLogEntry {
  id: string;
  date: string;
  content: string;
  contacts: string | null;
  recordingUrl: string | null;
  cardImages: string | null;
}

interface BusinessCardWithLogs {
  id: string;
  name: string;
  company: string;
  logs: DealLogEntry[];
}

function parseContacts(json: string | null): { name: string; title: string }[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return json.split(/[,、]/).map(s => ({ name: s.trim(), title: '' })).filter(c => c.name);
  }
  return [];
}

function parseCardImages(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
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
  const [dealLogs, setDealLogs] = useState<DealLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'history' | 'proposals' | 'deals'>('members');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

      // 商談ログを会社名で取得
      if (clientRes?.name) {
        try {
          const bcData = await apiClient<any[]>(`/business-cards?search=${encodeURIComponent(clientRes.name)}`);
          const matchedCards = (bcData || []).filter((bc: any) => bc.company === clientRes.name);
          const allLogs: DealLogEntry[] = matchedCards.flatMap((bc: any) =>
            (bc.logs || []).map((l: any) => ({
              id: l.id,
              date: l.date ? l.date.split('T')[0] : '',
              content: l.content || '',
              contacts: l.contacts || null,
              recordingUrl: l.recordingUrl || null,
              cardImages: l.cardImages || null,
            }))
          );
          allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setDealLogs(allLogs);
        } catch {
          setDealLogs([]);
        }
      }

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
          {/* 基本情報 */}
          <div className="card p-5">
            <div className={sectionLabel}>基本情報</div>
            <div className="space-y-0">
              {[
                ['法人番号', client.corporateNumber || '--'],
                ['インボイス番号', client.invoiceNumber || '--'],
                ['郵便番号', client.postalCode || '--'],
                ['本社所在地', client.address || '--'],
                ['代表者名', client.representName || '--'],
                ['設立年月', client.establishedDate || '--'],
                ['資本金', client.capital || '--'],
                ['Webサイト', client.websiteUrl || '--'],
              ].map(([l, v]) => (
                <div key={l} className={infoRow}>
                  <span className="text-secondary text-sm">{l}</span>
                  <span className="text-sm text-right max-w-[60%] break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 担当者情報 */}
          <div className="card p-5">
            <div className={sectionLabel}>担当者情報</div>
            <div className="space-y-0">
              {[
                ['先方担当者', client.contactPerson || '--'],
                ['メール', client.contactEmail || '--'],
                ['電話', client.contactPhone || '--'],
              ].map(([l, v]) => (
                <div key={l} className={infoRow}>
                  <span className="text-secondary text-sm">{l}</span>
                  <span className="text-sm text-right max-w-[60%] break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 取引情報 */}
          <div className="card p-5">
            <div className={sectionLabel}>取引情報</div>
            <div className="space-y-0">
              {[
                ['取引開始日', client.tradeStartDate ? fmtDate(client.tradeStartDate) : '--'],
                ['請求書送付先', client.billingEmail || '--'],
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
                { key: 'deals', label: `商談ログ (${dealLogs.length})` },
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

              {/* 商談ログ（タイムライン） */}
              {activeTab === 'deals' && (
                dealLogs.length === 0 ? (
                  <div className="text-sm text-secondary py-4 text-center">商談ログはありません</div>
                ) : (
                  <div className="relative">
                    {/* タイムライン縦線 */}
                    {dealLogs.length > 1 && (
                      <div className="absolute left-[11px] top-6 bottom-6 w-px bg-border/30" />
                    )}
                    <div className="space-y-0">
                      {dealLogs.map((log, idx) => (
                        <div key={log.id} className="relative pl-9 pb-6 last:pb-0">
                          {/* タイムラインドット */}
                          <div className={`absolute left-[6px] top-[6px] w-[11px] h-[11px] rounded-full border-2 ${idx === 0 ? 'border-primary bg-primary/20' : 'border-border/50 bg-card'}`} />

                          {/* ヘッダー: 日付 + 回数 */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">{fmtDate(log.date)}</span>
                            <span className="text-2xs text-secondary">({dealLogs.length - idx}回目)</span>
                          </div>

                          {/* 商談相手 */}
                          {log.contacts && parseContacts(log.contacts).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {parseContacts(log.contacts).map((person, nIdx) => (
                                <span key={nIdx} className="inline-flex items-center px-2 py-0.5 bg-page rounded text-xs border border-border/15">
                                  <span className="font-medium">{person.name}</span>
                                  {person.title && <span className="text-secondary ml-1">{person.title}</span>}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 内容 */}
                          <div className="text-sm whitespace-pre-wrap leading-relaxed text-primary/85">{log.content}</div>

                          {/* 名刺画像 */}
                          {parseCardImages(log.cardImages).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {parseCardImages(log.cardImages).map((img, imgIdx) => (
                                <img
                                  key={imgIdx}
                                  src={img}
                                  alt="名刺"
                                  className="h-20 rounded border border-border/30 shadow-sm cursor-pointer hover:opacity-80 hover:shadow-md transition-all"
                                  onClick={() => setLightboxImage(img)}
                                />
                              ))}
                            </div>
                          )}

                          {/* フッター */}
                          {log.recordingUrl && (
                            <div className="mt-2.5 text-xs">
                              <a href={log.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                <span>&#9654;</span><span>録画を見る</span>
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 名刺画像ライトボックス */}
      {lightboxImage && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[300]" onClick={() => setLightboxImage(null)} />
          <div className="fixed inset-0 z-[301] flex items-center justify-center p-8" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-card rounded-full shadow-lg flex items-center justify-center text-secondary hover:text-primary transition-colors z-[302]"
              >
                &#10005;
              </button>
              <img src={lightboxImage} alt="名刺（拡大）" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            </div>
          </div>
        </>
      )}

      <ToastUI />
    </div>
  );
}
