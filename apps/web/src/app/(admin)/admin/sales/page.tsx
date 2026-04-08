/**
 * 管理側 営業管理
 *
 * UIモックのpage-sales-pipelineを再現。
 * エンジニアごとのカード形式UI。KPI3枚（営業中/案件確定/未決定）。
 * 各エンジニアに提案先を複数登録、面談日程管理、確定→稼働管理連動。
 *
 * データソース:
 * - アサインがendedまたはstandbyの社員を自動表示
 * - 手動で「エンジニアを追加」でアクティブ社員も営業対象に追加可能
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface Proposal {
  client: string;
  project?: string;
  status: 'proposing' | 'interview' | 'waiting' | 'confirmed';
  interviewDate?: string;
  proposalId?: string;
  emailStatus?: 'draft' | 'sent' | 'failed';
}

interface Engineer {
  id: string;
  name: string;
  code?: string;
  salesStatus: 'proposing' | 'confirmed' | 'undecided';
  currentClient?: string;
  currentProject?: string;
  endDate?: string;
  proposals: Proposal[];
}

interface AssignmentData {
  id: string;
  employeeId: string;
  projectName: string;
  contractPrice: number;
  startDate: string;
  endDate: string | null;
  status: string;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
  client: { id: string; name: string };
}

interface EmployeeData {
  id: string;
  lastName: string;
  firstName: string;
  employeeCode: string;
  status: string;
}

interface ClientData {
  id: string;
  name: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
}

interface SkillsheetEmp {
  id: string;
  name: string;
  nameKana: string;
  employeeCode: string;
  hasSkillsheet: boolean;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  proposing: { label: '提案中', cls: 'badge-info' },
  interview: { label: '面談予定', cls: 'badge-warn' },
  waiting: { label: '結果待ち', cls: 'badge-wait' },
  confirmed: { label: '確定', cls: 'badge-ok' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ---------- 月キー ---------- */
function getMonthKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
}
function prevMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return getMonthKey(d);
}
function nextMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 1);
  return getMonthKey(d);
}

/* ---------- 確定履歴 ---------- */
interface ConfirmedRecord {
  engineerId: string;
  engineerName: string;
  engineerCode?: string;
  client: string;
  project?: string;
  confirmedAt: string; // ISO string
  month: string; // YYYY-MM
}

/* ---------- localStorage 永続化 ---------- */
const STORAGE_KEY = 'ses_sales_data';

interface SavedSalesData {
  /** エンジニアごとの提案・ステータス情報 */
  engineers: Record<string, {
    salesStatus: Engineer['salesStatus'];
    proposals: Proposal[];
  }>;
  /** 手動追加されたエンジニアID一覧 */
  manuallyAdded: string[];
  /** 月別確定履歴 */
  confirmedHistory: ConfirmedRecord[];
}

function loadSavedData(): SavedSalesData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { engineers: {}, manuallyAdded: [], confirmedHistory: [] };
}

function saveSalesData(engineers: Engineer[], manualIds: string[], confirmedHistory: ConfirmedRecord[]) {
  const data: SavedSalesData = { engineers: {}, manuallyAdded: manualIds, confirmedHistory };
  for (const e of engineers) {
    if (e.proposals.length > 0 || e.salesStatus !== 'undecided') {
      data.engineers[e.id] = {
        salesStatus: e.salesStatus,
        proposals: e.proposals,
      };
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export default function AdminSalesPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeData[]>([]);
  const [allClients, setAllClients] = useState<ClientData[]>([]);
  const [manuallyAddedIds, setManuallyAddedIds] = useState<string[]>([]);
  const [confirmedHistory, setConfirmedHistory] = useState<ConfirmedRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  // 提案追加モーダル（ステップ制御付き）
  const [proposalTarget, setProposalTarget] = useState<string | null>(null); // engineerId
  const [proposalClientId, setProposalClientId] = useState('');
  const [proposalProject, setProposalProject] = useState('');
  // メール送信フロー
  const [proposalStep, setProposalStep] = useState(1); // 1:クライアント選択 2:メール設定 3:確認
  const [proposalToEmail, setProposalToEmail] = useState('');
  const [proposalContactPerson, setProposalContactPerson] = useState('');
  const [proposalExtraEmpIds, setProposalExtraEmpIds] = useState<string[]>([]);
  const [proposalCustomMessage, setProposalCustomMessage] = useState('');
  const [proposalSending, setProposalSending] = useState(false);
  const [showMailSection, setShowMailSection] = useState(false);
  const [proposalEmpSearch, setProposalEmpSearch] = useState('');
  const [allSkillsheetEmps, setAllSkillsheetEmps] = useState<SkillsheetEmp[]>([]);
  const [proposalPreviewBody, setProposalPreviewBody] = useState('');
  const [proposalPreviewSubject, setProposalPreviewSubject] = useState('');
  const [proposalPreviewLoading, setProposalPreviewLoading] = useState(false);
  const [showEmpSearchDropdown, setShowEmpSearchDropdown] = useState(false);

  // メール送信モーダル（既存draft提案用）
  const [sendMailTarget, setSendMailTarget] = useState<{ engineerId: string; proposalIdx: number; proposalId: string; clientName: string } | null>(null);
  const [sendMailForm, setSendMailForm] = useState({ toEmail: '', contactPerson: '', customMessage: '' });
  const [sendMailLoading, setSendMailLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [assignRes, empRes, clientRes, skillsheetEmps] = await Promise.all([
        apiClient<{ data: AssignmentData[] }>('/assignments?limit=200'),
        apiClient<{ data: EmployeeData[] }>('/employees?limit=200'),
        apiClient<{ data: ClientData[] }>('/clients?limit=200').catch(() => ({ data: [] as ClientData[] })),
        apiClient<any[]>('/skillsheets').catch(() => [] as any[]),
      ]);
      setAllSkillsheetEmps(skillsheetEmps.filter((e: any) => e.hasSkillsheet).map((e: any) => ({
        id: e.id, name: e.name, nameKana: e.nameKana, employeeCode: e.employeeCode, hasSkillsheet: e.hasSkillsheet,
      })));

      const assignments = assignRes.data;
      const employees = empRes.data;
      setAllEmployees(employees);
      setAllClients(clientRes.data);

      // ended/standbyのアサインを持つ社員 or アサインが無い社員を営業対象にする
      const activeAssignEmployeeIds = new Set(
        assignments.filter(a => a.status === 'active').map(a => a.employeeId)
      );

      // ended/standbyのアサインからエンジニア情報を構築
      const endedStandbyAssignments = assignments.filter(
        a => a.status === 'ended' || a.status === 'standby'
      );

      const engineerMap = new Map<string, Engineer>();

      // ended/standbyのアサインがあるエンジニア
      for (const a of endedStandbyAssignments) {
        if (activeAssignEmployeeIds.has(a.employeeId)) continue; // activeがある人はスキップ
        if (!engineerMap.has(a.employeeId)) {
          engineerMap.set(a.employeeId, {
            id: a.employeeId,
            name: `${a.employee.lastName} ${a.employee.firstName}`,
            code: a.employee.employeeCode,
            salesStatus: 'undecided',
            currentClient: a.client?.name,
            currentProject: a.projectName,
            endDate: formatDate(a.endDate),
            proposals: [],
          });
        }
      }

      // アサインが一つもない社員も追加（待機中）
      for (const emp of employees) {
        if (emp.status !== 'active') continue;
        const hasAnyAssignment = assignments.some(a => a.employeeId === emp.id);
        if (!hasAnyAssignment && !engineerMap.has(emp.id)) {
          engineerMap.set(emp.id, {
            id: emp.id,
            name: `${emp.lastName} ${emp.firstName}`,
            code: emp.employeeCode,
            salesStatus: 'undecided',
            proposals: [],
          });
        }
      }

      // localStorageから保存データを復元
      const saved = loadSavedData();

      // 手動追加されたエンジニアを復元
      for (const empId of saved.manuallyAdded) {
        if (!engineerMap.has(empId)) {
          const emp = employees.find(e => e.id === empId);
          if (emp) {
            engineerMap.set(empId, {
              id: emp.id,
              name: `${emp.lastName} ${emp.firstName}`,
              code: emp.employeeCode,
              salesStatus: 'undecided',
              proposals: [],
            });
          }
        }
      }
      setManuallyAddedIds(saved.manuallyAdded);
      setConfirmedHistory(saved.confirmedHistory || []);

      // 保存済みの提案データをマージ
      for (const [id, data] of Object.entries(saved.engineers)) {
        const eng = engineerMap.get(id);
        if (eng) {
          eng.proposals = data.proposals;
          eng.salesStatus = data.salesStatus;
        }
      }

      setEngineers(Array.from(engineerMap.values()));
    } catch {
      // API error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // engineersが更新されたらlocalStorageに自動保存
  useEffect(() => {
    if (!loading && engineers.length > 0) {
      saveSalesData(engineers, manuallyAddedIds, confirmedHistory);
    }
  }, [engineers, manuallyAddedIds, confirmedHistory, loading]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const currentMonthKey = getMonthKey();
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const monthConfirmed = useMemo(() => confirmedHistory.filter(r => r.month === selectedMonth), [confirmedHistory, selectedMonth]);

  const kpis = useMemo(() => ({
    proposing: engineers.filter(e => e.salesStatus === 'proposing').length,
    confirmed: monthConfirmed.length,
    undecided: engineers.filter(e => e.salesStatus === 'undecided').length,
  }), [engineers, monthConfirmed]);

  const filtered = useMemo(() => {
    return engineers.filter(e => {
      if (search && !e.name.includes(search)) return false;
      if (statusFilter) {
        if (statusFilter === 'undecided' && e.salesStatus !== 'undecided') return false;
        if (statusFilter === 'proposing' && e.salesStatus !== 'proposing') return false;
        if (statusFilter === 'confirmed' && e.salesStatus !== 'confirmed') return false;
        if (['proposing_detail', 'interview', 'waiting', 'confirmed_detail'].includes(statusFilter)) {
          const mappedStatus = statusFilter.replace('_detail', '');
          const hasMatch = e.proposals.some(p => p.status === mappedStatus);
          if (!hasMatch) return false;
        }
      }
      return true;
    });
  }, [engineers, search, statusFilter]);

  // 手動で追加する社員リスト（既に営業リストにいない社員）
  const addableEmployees = useMemo(() => {
    const existingIds = new Set(engineers.map(e => e.id));
    return allEmployees
      .filter(e => e.status === 'active' && !existingIds.has(e.id))
      .filter(e => !addSearch || `${e.lastName} ${e.firstName}`.includes(addSearch));
  }, [allEmployees, engineers, addSearch]);

  const handleAddEngineer = (emp: EmployeeData) => {
    setEngineers(prev => [
      ...prev,
      {
        id: emp.id,
        name: `${emp.lastName} ${emp.firstName}`,
        code: emp.employeeCode,
        salesStatus: 'undecided',
        proposals: [],
      },
    ]);
    setManuallyAddedIds(prev => [...prev, emp.id]);
    setShowAddModal(false);
    setAddSearch('');
    toast(`${emp.lastName} ${emp.firstName}を営業リストに追加しました`);
  };

  const openProposalModal = (engineerId: string) => {
    setProposalTarget(engineerId);
    setProposalClientId('');
    setProposalProject('');
    setProposalStep(1);
    setProposalToEmail('');
    setProposalContactPerson('');
    setProposalExtraEmpIds([]);
    setProposalCustomMessage('');
    setProposalEmpSearch('');
    setProposalPreviewBody('');
    setProposalPreviewSubject('');
    setShowMailSection(false);
    setShowEmpSearchDropdown(false);
  };

  const proposalSelectedClient = useMemo(() => allClients.find(c => c.id === proposalClientId), [allClients, proposalClientId]);

  // 提案対象社員（メイン＋追加）
  const proposalAllEmpIds = useMemo(() => {
    const ids = proposalTarget ? [proposalTarget, ...proposalExtraEmpIds] : [...proposalExtraEmpIds];
    return Array.from(new Set(ids));
  }, [proposalTarget, proposalExtraEmpIds]);

  // 追加可能社員フィルタ
  const proposalAddableEmps = useMemo(() => {
    return allSkillsheetEmps
      .filter(e => e.id !== proposalTarget && !proposalExtraEmpIds.includes(e.id))
      .filter(e => {
        if (!proposalEmpSearch) return false;
        const q = proposalEmpSearch;
        // 一文字でもマッチすればOK
        return e.name.split('').some(c => q.includes(c)) || q.split('').some(c => e.name.includes(c)) || e.employeeCode.includes(q) || e.nameKana.includes(q);
      });
  }, [allSkillsheetEmps, proposalTarget, proposalExtraEmpIds, proposalEmpSearch]);

  // メールプレビュー取得
  const fetchPreview = async () => {
    if (!proposalClientId || proposalAllEmpIds.length === 0) return;
    setProposalPreviewLoading(true);
    try {
      const res = await apiClient<{ subject: string; bodyText: string }>('/proposals/preview', {
        method: 'POST',
        body: JSON.stringify({
          clientId: proposalClientId,
          employeeIds: proposalAllEmpIds,
          contactPerson: proposalContactPerson,
          customMessage: proposalCustomMessage,
        }),
      });
      setProposalPreviewSubject(res.subject);
      setProposalPreviewBody(res.bodyText);
    } catch {
      setProposalPreviewBody('プレビューの取得に失敗しました');
    } finally {
      setProposalPreviewLoading(false);
    }
  };

  // メール送信
  const handleSendProposal = async () => {
    if (!proposalClientId || proposalAllEmpIds.length === 0 || !proposalToEmail) return;
    if (!proposalTarget) return;
    setProposalSending(true);
    try {
      const res = await apiClient<any>('/proposals/send', {
        method: 'POST',
        body: JSON.stringify({
          clientId: proposalClientId,
          employeeIds: proposalAllEmpIds,
          toEmail: proposalToEmail,
          contactPerson: proposalContactPerson,
          customMessage: proposalCustomMessage,
        }),
      });
      const emailSt = res.status === 'sent' ? 'sent' : 'failed';
      if (res.status === 'sent') {
        toast('提案メールを送信しました');
      } else {
        toast('送信に失敗しましたが、履歴は保存されました');
      }
      // 提案をローカルstateに追加（メール送信済み）
      const selectedClient = allClients.find(c => c.id === proposalClientId);
      const clientName = selectedClient?.name || proposalClientId;
      setEngineers(prev => prev.map(e => {
        if (e.id !== proposalTarget) return e;
        return {
          ...e,
          salesStatus: 'proposing',
          proposals: [...e.proposals, {
            client: clientName,
            project: proposalProject || undefined,
            status: 'proposing' as const,
            proposalId: res.id,
            emailStatus: emailSt as 'sent' | 'failed',
          }],
        };
      }));
      setProposalTarget(null);
    } catch (err: any) {
      toast(err?.message || '送信に失敗しました');
      setProposalSending(false);
    }
  };

  const handleAddProposal = async () => {
    if (!proposalTarget || !proposalClientId) {
      toast('クライアントを選択してください');
      return;
    }
    const selectedClient = allClients.find(c => c.id === proposalClientId);
    const clientName = selectedClient?.name || proposalClientId;

    try {
      // DB保存（メールなし）
      const res = await apiClient<any>('/proposals', {
        method: 'POST',
        body: JSON.stringify({
          clientId: proposalClientId,
          employeeIds: proposalAllEmpIds,
          projectName: proposalProject || undefined,
        }),
      });

      setEngineers(prev => prev.map(e => {
        if (e.id !== proposalTarget) return e;
        return {
          ...e,
          salesStatus: 'proposing',
          proposals: [...e.proposals, {
            client: clientName,
            project: proposalProject || undefined,
            status: 'proposing' as const,
            proposalId: res.id,
            emailStatus: 'draft' as const,
          }],
        };
      }));
      toast('提案を追加しました');
      setProposalTarget(null);
    } catch (err: any) {
      toast(err?.message || '提案の追加に失敗しました');
    }
  };

  const handleProposalStatusChange = (engineerId: string, proposalIdx: number, newStatus: string) => {
    setEngineers(prev => prev.map(e => {
      if (e.id !== engineerId) return e;
      const newProposals = [...e.proposals];
      newProposals[proposalIdx] = { ...newProposals[proposalIdx], status: newStatus as Proposal['status'] };

      // 確定が1つでもあればconfirmed、提案中があればproposing、それ以外undecided
      let salesStatus: Engineer['salesStatus'] = 'undecided';
      if (newProposals.some(p => p.status === 'confirmed')) salesStatus = 'confirmed';
      else if (newProposals.length > 0) salesStatus = 'proposing';

      return { ...e, proposals: newProposals, salesStatus };
    }));
  };

  const handleInterviewDateChange = (engineerId: string, proposalIdx: number, date: string) => {
    setEngineers(prev => prev.map(e => {
      if (e.id !== engineerId) return e;
      const newProposals = [...e.proposals];
      newProposals[proposalIdx] = { ...newProposals[proposalIdx], interviewDate: date };
      return { ...e, proposals: newProposals };
    }));
  };

  // 既存draft提案にメール送信
  const openSendMailModal = (engineerId: string, proposalIdx: number, prop: Proposal) => {
    if (!prop.proposalId) return;
    // クライアント名からcontactEmail/contactPersonを取得
    const client = allClients.find(c => c.name === prop.client);
    setSendMailTarget({ engineerId, proposalIdx, proposalId: prop.proposalId, clientName: prop.client });
    setSendMailForm({
      toEmail: client?.contactEmail || '',
      contactPerson: client?.contactPerson || '',
      customMessage: '',
    });
  };

  const handleSendMailForDraft = async () => {
    if (!sendMailTarget || !sendMailForm.toEmail) return;
    setSendMailLoading(true);
    try {
      const res = await apiClient<any>(`/proposals/${sendMailTarget.proposalId}/send`, {
        method: 'POST',
        body: JSON.stringify({
          toEmail: sendMailForm.toEmail,
          contactPerson: sendMailForm.contactPerson || undefined,
          customMessage: sendMailForm.customMessage || undefined,
        }),
      });
      if (res.status === 'sent') {
        // ローカルstateのemailStatusを更新
        setEngineers(prev => prev.map(e => {
          if (e.id !== sendMailTarget.engineerId) return e;
          const newProposals = [...e.proposals];
          newProposals[sendMailTarget.proposalIdx] = {
            ...newProposals[sendMailTarget.proposalIdx],
            emailStatus: 'sent',
          };
          return { ...e, proposals: newProposals };
        }));
        toast('提案メールを送信しました');
      } else {
        toast('送信に失敗しました');
      }
      setSendMailTarget(null);
    } catch (err: any) {
      toast(err?.message || 'メール送信に失敗しました');
    } finally {
      setSendMailLoading(false);
    }
  };

  const handleCreateAssignment = (eng: Engineer, prop: Proposal) => {
    // 確定履歴に記録
    const record: ConfirmedRecord = {
      engineerId: eng.id,
      engineerName: eng.name,
      engineerCode: eng.code,
      client: prop.client,
      project: prop.project,
      confirmedAt: new Date().toISOString(),
      month: getMonthKey(),
    };
    setConfirmedHistory(prev => [...prev, record]);

    // 一覧から除外
    setEngineers(prev => prev.filter(e => e.id !== eng.id));
    setManuallyAddedIds(prev => prev.filter(id => id !== eng.id));

    // アサイン登録画面へ
    const client = allClients.find(c => c.name === prop.client);
    const params = new URLSearchParams();
    params.set('employeeName', eng.name);
    if (eng.code) params.set('employeeCode', eng.code);
    if (client) params.set('clientId', client.id);
    if (prop.project) params.set('projectName', prop.project);
    router.push(`/admin/assignments/new?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">営業管理</h1>
        <button onClick={() => setShowAddModal(true)} className="btn-outline text-sm py-2">エンジニアを追加</button>
      </div>

      {/* 月ナビ */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setSelectedMonth(prevMonth(selectedMonth))} className="text-secondary hover:text-primary text-sm px-2 py-1">◀</button>
        <span className="text-base font-medium min-w-[100px] text-center">{monthLabel(selectedMonth)}</span>
        <button onClick={() => setSelectedMonth(nextMonth(selectedMonth))} disabled={selectedMonth >= currentMonthKey} className="text-secondary hover:text-primary text-sm px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed">▶</button>
        {!isCurrentMonth && (
          <button onClick={() => setSelectedMonth(currentMonthKey)} className="text-xs text-primary hover:underline ml-2">今月に戻る</button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">{isCurrentMonth ? '営業中' : `${monthLabel(selectedMonth)} 営業中`}</div>
          <div className="text-3xl font-medium text-status-blue-text">{isCurrentMonth ? kpis.proposing : '--'}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">{monthLabel(selectedMonth)} 確定</div>
          <div className="text-3xl font-medium text-status-green-text">{kpis.confirmed}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">{isCurrentMonth ? '未決定' : `${monthLabel(selectedMonth)} 未決定`}</div>
          <div className="text-3xl font-medium text-status-amber-text">{isCurrentMonth ? kpis.undecided : '--'}<span className="text-base font-normal ml-1">名</span></div>
        </div>
      </div>

      {/* 今月確定一覧 */}
      {monthConfirmed.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="text-xs text-secondary mb-2">{monthLabel(selectedMonth)} 確定済みエンジニア</div>
          <div className="space-y-0">
            {monthConfirmed.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="badge badge-ok">確定</span>
                  <span className="text-[15px] font-medium">{r.engineerName}</span>
                  {r.engineerCode && <span className="text-xs text-secondary">{r.engineerCode}</span>}
                </div>
                <div className="flex items-center gap-3 text-[13px] text-secondary">
                  <span>{r.client}</span>
                  {r.project && <span className="text-xs">/ {r.project}</span>}
                  <span className="text-xs">{(() => { const d = new Date(r.confirmedAt); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; })()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* フィルタ */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none min-w-[160px]">
          <option value="">ステータス: すべて</option>
          <option value="undecided">未決定</option>
          <option value="proposing">営業中</option>
          <option value="confirmed">案件確定</option>
        </select>
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[160px] focus:border-primary" />
        <span className="text-xs text-secondary ml-1">{filtered.length}名 表示中</span>
      </div>

      {/* エンジニアカード */}
      <div className="space-y-3">
        {loading ? (
          <div className="card px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="card px-4 py-8 text-center text-sm text-secondary">データはありません</div>
        ) : (
          filtered.map(eng => {
            const isExpanded = expandedIds.has(eng.id);
            return (
              <div key={eng.id} className="card p-5">
                {/* エンジニアヘッダー行 */}
                <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => toggleExpand(eng.id)}>
                  <span className="text-xs text-secondary select-none">{isExpanded ? '▼' : '▶'}</span>
                  <span className={`badge ${eng.salesStatus === 'confirmed' ? 'badge-ok' : eng.salesStatus === 'proposing' ? 'badge-info' : 'badge-warn'}`}>
                    {eng.salesStatus === 'confirmed' ? '案件確定' : eng.salesStatus === 'proposing' ? '営業中' : '未決定'}
                  </span>
                  <span className="text-[15px] font-medium">{eng.name}</span>
                  {eng.code && <span className="text-xs text-secondary">{eng.code}</span>}
                  <div className="ml-auto flex gap-4 text-[13px] text-secondary">
                    <span>{eng.currentClient ? `前: ${eng.currentClient}` : '未稼働'}</span>
                    {eng.endDate && eng.endDate !== '--' && <span className="text-status-amber-text">終了: {eng.endDate}</span>}
                  </div>
                </div>

                {/* 提案一覧（展開時） */}
                {isExpanded && (
                  <>
                    {eng.proposals.length > 0 && (
                      <div className="border-t border-border/30 mt-3 pt-2.5">
                        {eng.proposals.map((prop, idx) => {
                          const st = statusLabels[prop.status];
                          return (
                            <div key={idx} className="py-2.5 border-b border-border/20">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <div className="min-w-[180px]">
                                  <div className="text-[13px] font-medium">{prop.client}</div>
                                  {prop.project && <div className="text-xs text-secondary">{prop.project}</div>}
                                </div>
                                <select
                                  className="border border-border rounded px-2 py-1 text-xs bg-card outline-none appearance-none"
                                  value={prop.status}
                                  onChange={e => handleProposalStatusChange(eng.id, idx, e.target.value)}
                                >
                                  <option value="proposing">提案中</option>
                                  <option value="interview">面談予定</option>
                                  <option value="waiting">結果待ち</option>
                                  <option value="confirmed">確定</option>
                                </select>
                                <span className={`badge ${st.cls}`}>{st.label}</span>

                                {/* メール送信状態バッジ */}
                                {prop.emailStatus === 'draft' && (
                                  <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>メール未送信</span>
                                )}
                                {prop.emailStatus === 'sent' && (
                                  <span className="badge badge-ok">メール送信済</span>
                                )}

                                {/* draft提案：メール送信ボタン */}
                                {prop.emailStatus === 'draft' && prop.proposalId && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openSendMailModal(eng.id, idx, prop); }}
                                    className="btn-outline text-[11px] py-0.5 px-2.5"
                                  >
                                    メール送信
                                  </button>
                                )}

                                {/* 確定時：アサイン登録ボタン */}
                                {prop.status === 'confirmed' && (
                                  <button
                                    onClick={() => handleCreateAssignment(eng, prop)}
                                    className="btn-primary text-[11px] py-1 px-3 ml-auto"
                                  >
                                    アサイン登録
                                  </button>
                                )}
                              </div>

                              {/* 面談予定時：日程入力 */}
                              {prop.status === 'interview' && (
                                <div className="flex items-center gap-2 mt-2 ml-0 pl-0">
                                  <span className="text-xs text-secondary">面談日時:</span>
                                  <input
                                    type="datetime-local"
                                    value={prop.interviewDate || ''}
                                    onChange={e => handleInterviewDateChange(eng.id, idx, e.target.value)}
                                    className="border border-border rounded px-2 py-1 text-xs bg-card outline-none focus:border-primary"
                                  />
                                  {prop.interviewDate && (
                                    <span className="text-xs text-status-green-text">設定済</span>
                                  )}
                                </div>
                              )}

                              {/* 結果待ち時：面談日の表示 */}
                              {prop.status === 'waiting' && prop.interviewDate && (
                                <div className="mt-1.5 text-xs text-secondary">
                                  面談実施日: {(() => { const d = new Date(prop.interviewDate!); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}時${String(d.getMinutes()).padStart(2, '0')}分`; })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {eng.proposals.length === 0 && (
                      <div className="border-t border-border/30 mt-3 pt-2.5 text-sm text-secondary">提案先はまだありません</div>
                    )}
                    <div className="mt-2">
                      <button onClick={() => openProposalModal(eng.id)} className="btn-outline text-[11px] py-0.5 px-2.5">＋ 提案を追加</button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* エンジニア追加モーダル */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[99]" onClick={() => { setShowAddModal(false); setAddSearch(''); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[480px] bg-card border border-border rounded-xl z-[100] shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-border/30">
              <h2 className="text-lg font-medium">エンジニアを追加</h2>
              <button onClick={() => { setShowAddModal(false); setAddSearch(''); }} className="text-secondary hover:text-primary text-xl">✕</button>
            </div>
            <div className="p-5">
              <input
                type="text"
                placeholder="氏名で検索"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary mb-3"
              />
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {addableEmployees.length === 0 ? (
                  <div className="text-sm text-secondary py-4 text-center">追加可能な社員はいません</div>
                ) : (
                  addableEmployees.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => handleAddEngineer(emp)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-page cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium">{emp.lastName} {emp.firstName}</span>
                        <span className="text-xs text-secondary ml-2">{emp.employeeCode}</span>
                      </div>
                      <span className="text-xs text-primary">追加</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 提案追加モーダル（ステップ制御） */}
      {proposalTarget && (() => {
        const targetEng = engineers.find(e => e.id === proposalTarget);
        const targetName = targetEng?.name || '';
        const labelCls = 'block text-xs text-secondary mb-1';
        const inputCls = 'w-full border border-border rounded-md px-3 py-2 text-sm outline-none bg-card focus:border-primary';

        return (
          <>
            <div className="fixed inset-0 bg-black/20 z-[99]" onClick={() => setProposalTarget(null)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[520px] bg-card border border-border rounded-xl z-[100] shadow-xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center p-5 border-b border-border/30">
                <h2 className="text-lg font-medium">提案を追加 — {targetName}</h2>
                <button onClick={() => setProposalTarget(null)} className="text-secondary hover:text-primary text-xl">✕</button>
              </div>

              <div className="p-5 space-y-4">
                {/* ステップ1: クライアント選択 */}
                <div>
                  <label className={labelCls}>提案先クライアント <span className="text-status-red-text">*</span></label>
                  <select value={proposalClientId} onChange={e => setProposalClientId(e.target.value)} className={`${inputCls} appearance-none`}>
                    <option value="">選択してください</option>
                    {allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>案件名（任意）</label>
                  <input type="text" value={proposalProject} onChange={e => setProposalProject(e.target.value)} placeholder="案件名を入力" className={inputCls} />
                </div>

                {/* メールあり選択時のみ送信先情報を表示 */}
                {proposalClientId && showMailSection && (
                  <>
                    <hr className="border-border/30" />
                    <div className="text-sm font-medium text-[#2c3e6b]">提案メール送信</div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>送信先メールアドレス</label>
                        <input type="email" value={proposalToEmail} onChange={e => setProposalToEmail(e.target.value)} placeholder="client@example.com" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>担当者名</label>
                        <input type="text" value={proposalContactPerson} onChange={e => setProposalContactPerson(e.target.value)} placeholder="山田太郎" className={inputCls} />
                      </div>
                    </div>

                    {/* 一緒に提案する社員 */}
                    <div>
                      <label className={labelCls}>一緒に提案する社員（複数選択可）</label>
                      {proposalExtraEmpIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {proposalExtraEmpIds.map(id => {
                            const emp = allSkillsheetEmps.find(e => e.id === id) || engineers.find(e => e.id === id);
                            const empName = emp ? ('name' in emp ? emp.name : '') : id;
                            return (
                              <span key={id} className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs flex items-center gap-1">
                                {empName}
                                <button onClick={() => setProposalExtraEmpIds(prev => prev.filter(v => v !== id))} className="text-primary/60 hover:text-primary">&times;</button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* 営業一覧からプルダウン選択 */}
                      <select
                        className={`${inputCls} appearance-none mb-2`}
                        value=""
                        onChange={e => {
                          if (e.target.value) {
                            setProposalExtraEmpIds(prev => [...prev, e.target.value]);
                          }
                        }}
                      >
                        <option value="">営業一覧から選択...</option>
                        {engineers
                          .filter(e => e.id !== proposalTarget && !proposalExtraEmpIds.includes(e.id))
                          .map(e => <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ''}</option>)
                        }
                      </select>

                      {/* それ以外の社員を検索して追加 */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="その他の社員を検索して追加..."
                          value={proposalEmpSearch}
                          onChange={e => { setProposalEmpSearch(e.target.value); setShowEmpSearchDropdown(true); }}
                          onFocus={() => setShowEmpSearchDropdown(true)}
                          className={inputCls}
                        />
                        {showEmpSearchDropdown && proposalEmpSearch && (
                          <div className="absolute left-0 right-0 border border-border/20 rounded-md mt-1 max-h-[150px] overflow-y-auto bg-card z-10 shadow-lg">
                            {proposalAddableEmps.slice(0, 10).map(emp => (
                              <div
                                key={emp.id}
                                className="flex items-center justify-between px-3 py-2 hover:bg-[#F7F7F5] cursor-pointer text-sm"
                                onClick={() => {
                                  setProposalExtraEmpIds(prev => [...prev, emp.id]);
                                  setProposalEmpSearch('');
                                  setShowEmpSearchDropdown(false);
                                }}
                              >
                                <span>{emp.name} <span className="text-xs text-secondary">({emp.employeeCode})</span></span>
                                <span className="text-xs text-primary">追加</span>
                              </div>
                            ))}
                            {proposalAddableEmps.length === 0 && (
                              <div className="text-xs text-secondary text-center py-3">該当なし</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 追加メッセージ */}
                    <div>
                      <label className={labelCls}>追加メッセージ（任意）</label>
                      <textarea
                        className={`${inputCls} resize-y font-[inherit]`}
                        style={{ height: 50 }}
                        placeholder="挨拶文と署名の間に追記"
                        value={proposalCustomMessage}
                        onChange={e => setProposalCustomMessage(e.target.value)}
                      />
                    </div>

                    {/* 送信内容プレビュー */}
                    {proposalToEmail && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-secondary">メールプレビュー</span>
                          <button
                            onClick={fetchPreview}
                            disabled={proposalPreviewLoading}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {proposalPreviewLoading ? '読み込み中...' : proposalPreviewBody ? '再読み込み' : 'プレビューを表示'}
                          </button>
                        </div>
                        <div className="bg-[#F7F7F5] rounded-md p-3 text-xs text-secondary space-y-1">
                          <div className="flex gap-2"><span className="text-secondary/60">To:</span> {proposalToEmail}</div>
                          <div className="flex gap-2"><span className="text-secondary/60">From:</span> sales@lervia.co.jp</div>
                          <div className="flex gap-2"><span className="text-secondary/60">件名:</span> {proposalPreviewSubject || `【人材ご提案】エンジニア${proposalAllEmpIds.length}名のご紹介`}</div>
                          {proposalPreviewBody && (
                            <>
                              <hr className="border-border/30 my-2" />
                              <pre className="whitespace-pre-wrap font-[inherit] text-xs text-primary/80 leading-relaxed max-h-[300px] overflow-y-auto">
                                {proposalPreviewBody}
                              </pre>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ボタン */}
                <div className="flex gap-2 pt-2">
                  {showMailSection ? (
                    <>
                      <button onClick={() => setShowMailSection(false)} className="btn-outline flex-1 text-sm py-2">戻る</button>
                      <button
                        onClick={handleSendProposal}
                        disabled={proposalSending || !proposalToEmail}
                        className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
                      >
                        {proposalSending ? '送信中...' : '提案を追加＆メール送信'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleAddProposal}
                        className="btn-outline flex-1 text-sm py-2"
                        disabled={!proposalClientId}
                      >
                        提案を追加（メールなし）
                      </button>
                      <button
                        onClick={() => {
                          if (!proposalClientId) { toast('クライアントを選択してください'); return; }
                          const cl = allClients.find(c => c.id === proposalClientId) as any;
                          setProposalToEmail(cl?.contactEmail || '');
                          setProposalContactPerson(cl?.contactPerson || '');
                          setShowMailSection(true);
                        }}
                        className="btn-primary flex-1 text-sm py-2"
                        disabled={!proposalClientId}
                      >
                        提案を追加（メールあり）
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* メール送信モーダル（draft提案用） */}
      {sendMailTarget && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[99]" onClick={() => setSendMailTarget(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
            <div className="bg-card rounded-lg shadow-lg p-6 w-full max-w-md pointer-events-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-medium">メール送信 — {sendMailTarget.clientName}</h3>
                <button onClick={() => setSendMailTarget(null)} className="text-secondary hover:text-primary text-xl">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-secondary block mb-1">送信先メールアドレス *</label>
                  <input
                    type="email"
                    value={sendMailForm.toEmail}
                    onChange={e => setSendMailForm(f => ({ ...f, toEmail: e.target.value }))}
                    placeholder="client@example.com"
                    className="w-full border border-border rounded px-3 py-2 text-sm bg-card outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">担当者名</label>
                  <input
                    type="text"
                    value={sendMailForm.contactPerson}
                    onChange={e => setSendMailForm(f => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="山田太郎"
                    className="w-full border border-border rounded px-3 py-2 text-sm bg-card outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">追加メッセージ</label>
                  <textarea
                    value={sendMailForm.customMessage}
                    onChange={e => setSendMailForm(f => ({ ...f, customMessage: e.target.value }))}
                    placeholder="追加で伝えたい内容があれば入力"
                    rows={3}
                    className="w-full border border-border rounded px-3 py-2 text-sm bg-card outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setSendMailTarget(null)} className="btn-outline text-sm py-2 px-4">キャンセル</button>
                <button
                  onClick={handleSendMailForDraft}
                  disabled={!sendMailForm.toEmail || sendMailLoading}
                  className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
                >
                  {sendMailLoading ? '送信中...' : 'メール送信'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ToastUI />
    </div>
  );
}
