/**
 * 管理側 稼働管理
 *
 * タブベースUI: 稼働中 / 待機中 / 終了済み / 終了予定 / 新規
 * エリア別KPIカード + フィルタ + タブ + テーブル。
 * 契約終了日が30日以内=アンバー、7日以内=赤で行を警告。
 * 行クリック→詳細パネル。
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */

interface Assignment {
  id: string;
  employeeId: string;
  clientId: string;
  projectId: string | null;
  projectName: string;
  contractPrice: number;
  settlementLower: number;
  settlementUpper: number;
  overtimeRate: number | null;
  deductionRate: number | null;
  workLocation: string | null;
  area: string | null;
  defaultStartTime: string | null;
  attendanceFormat: string;
  clientAttendanceRequired: boolean;
  startDate: string;
  endDate: string | null;
  status: string;
  endReason: string | null;
  employee: { id: string; lastName: string; firstName: string; employeeCode: string };
  client: { id: string; name: string };
}

interface UnassignedEmployee {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  status: string;
  hireDate: string;
  departmentName: string;
}

type TabKey = 'active' | 'standby' | 'ended' | 'ending_scheduled' | 'new';

/* ---------- 定数 ---------- */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: '稼働中' },
  { key: 'standby', label: '待機中' },
  { key: 'ended', label: '終了済み' },
  { key: 'ending_scheduled', label: '終了予定' },
  { key: 'new', label: '新規' },
];

const areaLabel: Record<string, string> = {
  tokyo: '東京',
  osaka: '大阪',
  nagoya: '名古屋',
};

const endReasonLabel: Record<string, string> = {
  term_end: '期間満了',
  client_reason: 'クライアント都合',
  skill_shortage: '本人都合 / 技術不足',
  attendance_issue: '本人都合 / 勤怠不良',
  early_termination: '途中終了',
};

/* ---------- ユーティリティ ---------- */

function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 9999;
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - new Date().getTime()) / 86400000);
}

/**
 * DB上のstatusと日付から表示用タブを算出
 */
function computeDisplayTab(
  a: Assignment,
  today: Date,
  currentMonth: Date,
  activeEmployeeIds: Set<string>,
): Exclude<TabKey, 'new'> {
  if (a.status === 'active') return 'active';

  if (a.status === 'ending_scheduled') {
    // endDateを過ぎた → 待機中（ただし同一社員にactiveアサインがあれば除外）
    if (a.endDate && new Date(a.endDate) < today && !activeEmployeeIds.has(a.employeeId)) {
      return 'standby';
    }
    return 'ending_scheduled';
  }

  if (a.status === 'ended') {
    // endDateの月 < 当月 → 待機中
    if (a.endDate) {
      const endMonth = new Date(new Date(a.endDate).getFullYear(), new Date(a.endDate).getMonth(), 1);
      if (currentMonth > endMonth && !activeEmployeeIds.has(a.employeeId)) {
        return 'standby';
      }
    }
    return 'ended';
  }

  if (a.status === 'standby') return 'standby';

  // next_confirmed などはactiveとして扱う
  return 'active';
}

/* ---------- メインコンポーネント ---------- */

export default function AdminAssignmentsPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  // データ
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState<UnassignedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // タブ・フィルタ
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [clientFilter, setClientFilter] = useState('');
  const [search, setSearch] = useState('');

  // 詳細パネル
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 稼働終了モーダル
  const [showEndModal, setShowEndModal] = useState(false);
  const [endMode, setEndMode] = useState<'scheduled' | 'immediate'>('scheduled');
  const [endDate, setEndDate] = useState('');
  const [endReason, setEndReason] = useState('term_end');

  // 契約延長モーダル
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDate, setExtendDate] = useState('');

  // 編集モーダル
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    projectName: '',
    contractPrice: '',
    rewardRate: '',
    settlementLower: '',
    settlementUpper: '',
    overtimeRate: '',
    deductionRate: '',
    contractStartDate: '',
    contractEndDate: '',
    workStartTime: '',
    attendanceFormat: 'none',
    clientAttendanceRequired: true,
    workLocation: '',
    area: '',
    supplyChain: '一次請け',
    remarks: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  /* ---------- データ取得 ---------- */

  const loadAssignments = useCallback(async () => {
    try {
      const res = await apiClient<{ data: Assignment[]; total: number }>('/assignments?limit=200');
      setAssignments(res.data);
    } catch {
      // API error
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnassignedEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const res = await apiClient<{ data: UnassignedEmployee[]; total: number }>('/employees/unassigned');
      setUnassignedEmployees(res.data);
    } catch {
      // API error
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
    loadUnassignedEmployees();
  }, [loadAssignments, loadUnassignedEmployees]);

  /* ---------- タブ別データ算出 ---------- */

  const tabData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const activeEmployeeIds = new Set(
      assignments.filter(a => a.status === 'active').map(a => a.employeeId),
    );

    const groups: Record<Exclude<TabKey, 'new'>, Assignment[]> = {
      active: [],
      standby: [],
      ended: [],
      ending_scheduled: [],
    };

    for (const a of assignments) {
      const tab = computeDisplayTab(a, today, currentMonth, activeEmployeeIds);
      groups[tab].push(a);
    }

    return groups;
  }, [assignments]);

  const tabCounts = useMemo(() => ({
    active: tabData.active.length,
    standby: tabData.standby.length,
    ended: tabData.ended.length,
    ending_scheduled: tabData.ending_scheduled.length,
    new: unassignedEmployees.length,
  }), [tabData, unassignedEmployees]);

  /* ---------- フィルタ・ソート ---------- */

  const filteredTabItems = useMemo(() => {
    if (activeTab === 'new') return [];
    const items = tabData[activeTab] || [];
    const filtered = items.filter(a => {
      if (clientFilter && a.client.name !== clientFilter) return false;
      if (search) {
        const name = `${a.employee.lastName} ${a.employee.firstName}`;
        if (!name.includes(search)) return false;
      }
      return true;
    });

    // タブ別ソート
    return filtered.sort((a, b) => {
      if (activeTab === 'active' || activeTab === 'ending_scheduled') {
        // endDate昇順（終了間近が上）
        return daysUntil(a.endDate) - daysUntil(b.endDate);
      }
      // standby, ended: endDate降順
      return daysUntil(b.endDate) - daysUntil(a.endDate);
    });
  }, [activeTab, tabData, clientFilter, search]);

  const filteredNewEmployees = useMemo(() => {
    if (activeTab !== 'new') return [];
    if (!search) return unassignedEmployees;
    return unassignedEmployees.filter(e => {
      const name = `${e.lastName} ${e.firstName}`;
      return name.includes(search) || e.employeeCode.includes(search);
    });
  }, [activeTab, unassignedEmployees, search]);

  const selected = selectedId ? assignments.find(a => a.id === selectedId) : null;
  const selectedDisplayTab = selected ? (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const activeEmployeeIds = new Set(
      assignments.filter(a => a.status === 'active').map(a => a.employeeId),
    );
    return computeDisplayTab(selected, today, currentMonth, activeEmployeeIds);
  })() : null;

  // クライアント一覧（フィルタ用）
  const clientNames = useMemo(() => {
    const names = new Set(assignments.map(a => a.client.name));
    return Array.from(names).sort();
  }, [assignments]);

  // エリア別KPI
  const areaKpis = useMemo(() => {
    const areas: ('tokyo' | 'osaka' | 'nagoya')[] = ['tokyo', 'osaka', 'nagoya'];
    return areas.map(area => {
      const inArea = assignments.filter(a => a.area === area);
      const active = inArea.filter(a => a.status === 'active').length;
      const total = inArea.length;
      const ending = inArea.filter(a => a.status === 'active' && daysUntil(a.endDate) <= 30).length;
      return { area, label: areaLabel[area], active, total, rate: total ? Math.round(active / total * 100) : 0, ending };
    });
  }, [assignments]);

  /* ---------- アクション ---------- */

  const openEndModal = () => {
    setEndMode('scheduled');
    setEndDate('');
    setEndReason('term_end');
    setShowEndModal(true);
  };

  const handleEndAssignment = async () => {
    if (!selected) return;
    if (endMode === 'immediate' && !endDate) {
      toast('終了日を指定してください');
      return;
    }
    if (!endReason) {
      toast('終了理由を選択してください');
      return;
    }
    try {
      await apiClient(`/assignments/${selected.id}/end`, {
        method: 'POST',
        body: JSON.stringify({
          mode: endMode,
          endDate: endMode === 'immediate' ? endDate : undefined,
          endReason,
        }),
      });
      toast(endMode === 'scheduled' ? '終了予定に設定しました' : '稼働を終了しました');
      setShowEndModal(false);
      setSelectedId(null);
      loadAssignments();
    } catch {
      toast('稼働終了に失敗しました');
    }
  };

  const openExtendModal = () => {
    setExtendDate(selected?.endDate ? selected.endDate.split('T')[0] : '');
    setShowExtendModal(true);
  };

  const handleExtendAssignment = async () => {
    if (!selected || !extendDate) {
      toast('新しい終了日を指定してください');
      return;
    }
    try {
      await apiClient(`/assignments/${selected.id}/extend`, {
        method: 'PATCH',
        body: JSON.stringify({ endDate: extendDate }),
      });
      toast('契約を延長しました');
      setShowExtendModal(false);
      setSelectedId(null);
      loadAssignments();
    } catch {
      toast('契約延長に失敗しました');
    }
  };

  /* ---------- 編集モーダル ---------- */

  const openEditModal = () => {
    if (!selected) return;
    setEditForm({
      projectName: selected.projectName || '',
      contractPrice: selected.contractPrice ? String(selected.contractPrice) : '',
      rewardRate: '',
      settlementLower: selected.settlementLower ? String(selected.settlementLower) : '',
      settlementUpper: selected.settlementUpper ? String(selected.settlementUpper) : '',
      overtimeRate: selected.overtimeRate ? String(selected.overtimeRate) : '',
      deductionRate: selected.deductionRate ? String(selected.deductionRate) : '',
      contractStartDate: selected.startDate?.split('T')[0] || '',
      contractEndDate: selected.endDate?.split('T')[0] || '',
      workStartTime: selected.defaultStartTime || '9:00',
      attendanceFormat: selected.attendanceFormat || 'none',
      clientAttendanceRequired: selected.clientAttendanceRequired ?? true,
      workLocation: selected.workLocation || '',
      area: selected.area || '',
      supplyChain: '一次請け',
      remarks: '',
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!selected) return;
    setEditSaving(true);
    try {
      await apiClient(`/assignments/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          projectName: editForm.projectName || undefined,
          contractPrice: editForm.contractPrice ? parseInt(editForm.contractPrice.replace(/,/g, ''), 10) : undefined,
          settlementLower: editForm.settlementLower ? parseInt(editForm.settlementLower, 10) : undefined,
          settlementUpper: editForm.settlementUpper ? parseInt(editForm.settlementUpper, 10) : undefined,
          overtimeRate: editForm.overtimeRate ? parseInt(editForm.overtimeRate.replace(/,/g, ''), 10) : null,
          deductionRate: editForm.deductionRate ? parseInt(editForm.deductionRate.replace(/,/g, ''), 10) : null,
          startDate: editForm.contractStartDate || undefined,
          endDate: editForm.contractEndDate || undefined,
          defaultStartTime: editForm.workStartTime || undefined,
          attendanceFormat: editForm.attendanceFormat,
          clientAttendanceRequired: editForm.clientAttendanceRequired,
          workLocation: editForm.workLocation || undefined,
          area: editForm.area || undefined,
        }),
      });
      toast('アサイン情報を更新しました');
      setShowEditModal(false);
      setSelectedId(null);
      loadAssignments();
    } catch {
      toast('更新に失敗しました');
    } finally {
      setEditSaving(false);
    }
  };

  /* ---------- タブ別空メッセージ ---------- */
  const emptyMessage: Record<TabKey, string> = {
    active: '稼働中のアサインはありません',
    standby: '待機中の社員はいません',
    ended: '終了済みのアサインはありません',
    ending_scheduled: '終了予定のアサインはありません',
    new: 'アサイン未経験の社員はいません',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">稼働管理</h1>
        <button
          onClick={() => router.push('/admin/assignments/new')}
          className="btn-primary text-sm py-2"
        >
          新規アサイン登録
        </button>
      </div>

      {/* エリア別KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {areaKpis.map(kpi => (
          <div key={kpi.area} className="card p-4">
            <div className="text-xs text-secondary mb-1">{kpi.label}エリア</div>
            <div className="flex items-end gap-3">
              <div className="text-2xl font-medium">{kpi.rate}<span className="text-sm font-normal text-secondary">%</span></div>
              <div className="text-sm text-secondary">{kpi.active}名 / {kpi.total}名</div>
            </div>
            {kpi.ending > 0 && (
              <div className="text-xs text-status-amber-text mt-1">契約終了30日以内: {kpi.ending}名</div>
            )}
          </div>
        ))}
      </div>

      {/* タブバー */}
      <div className="flex border-b border-border/30 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
            className={`px-5 py-3 text-sm transition-colors relative ${
              activeTab === tab.key ? 'text-primary' : 'text-secondary hover:text-primary/60'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-secondary">({tabCounts[tab.key]})</span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* フィルタ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {activeTab !== 'new' && (
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none">
            <option value="">クライアント: すべて</option>
            {clientNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        <input type="text" placeholder="氏名で検索" value={search} onChange={e => setSearch(e.target.value)} className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[160px] focus:border-primary" />
        <span className="text-sm text-secondary self-center">
          {activeTab === 'new' ? filteredNewEmployees.length : filteredTabItems.length}件
        </span>
      </div>

      {/* テーブル */}
      {activeTab === 'new' ? (
        /* 新規タブ: 社員テーブル */
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                {['社員番号', '氏名', '入社日'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingEmployees ? (
                <tr><td colSpan={3}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
              ) : filteredNewEmployees.length === 0 ? (
                <tr><td colSpan={3}><div className="px-4 py-8 text-center text-sm text-secondary">{emptyMessage.new}</div></td></tr>
              ) : filteredNewEmployees.map(e => (
                <tr
                  key={e.id}
                  onClick={() => router.push(`/admin/assignments/new?employeeId=${e.id}`)}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 text-sm text-secondary">{e.employeeCode}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{e.lastName} {e.firstName}</td>
                  <td className="px-4 py-2.5 text-base">{formatDate(e.hireDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* アサインテーブル */
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border">
                {['氏名', 'クライアント / 案件', '契約単価', '精算幅', '契約開始日', '契約終了日'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
              ) : filteredTabItems.length === 0 ? (
                <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">{emptyMessage[activeTab]}</div></td></tr>
              ) : filteredTabItems.map(a => {
                const days = daysUntil(a.endDate);
                const rowBg = activeTab === 'active' && days <= 7 ? 'bg-status-red-bg/40' : activeTab === 'active' && days <= 30 ? 'bg-status-amber-bg/40' : '';
                const name = `${a.employee.lastName} ${a.employee.firstName}`;
                return (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)} className={`border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors ${rowBg}`}>
                    <td className="px-4 py-2.5 text-base font-medium whitespace-nowrap">{name}</td>
                    <td className="px-4 py-2.5 text-base whitespace-nowrap">{a.client.name} / {a.projectName}</td>
                    <td className="px-4 py-2.5 text-base tabular-nums text-right whitespace-nowrap">{a.contractPrice ? fmt(a.contractPrice) + '円' : '--'}</td>
                    <td className="px-4 py-2.5 text-base text-right whitespace-nowrap">{a.settlementLower ? `${a.settlementLower}〜${a.settlementUpper}h` : '--'}</td>
                    <td className="px-4 py-2.5 text-base text-right whitespace-nowrap">{formatDate(a.startDate)}</td>
                    <td className="px-4 py-2.5 text-base text-right whitespace-nowrap">{formatDate(a.endDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 詳細パネル */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.employee.lastName} {selected.employee.firstName}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.client.name}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              {/* 契約情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">契約情報</div>
                {[
                  ['案件名', selected.projectName || '--'],
                  ['契約単価（月額）', selected.contractPrice ? fmt(selected.contractPrice) + '円' : '--'],
                  ['精算幅', selected.settlementLower ? `${selected.settlementLower}〜${selected.settlementUpper}h` : '--'],
                  ['超過1h単価', selected.overtimeRate ? fmt(selected.overtimeRate) + '円' : '自動（契約単価÷上限）'],
                  ['控除1h単価', selected.deductionRate ? fmt(selected.deductionRate) + '円' : '自動（契約単価÷下限）'],
                  ['契約期間', `${formatDate(selected.startDate)} 〜 ${formatDate(selected.endDate)}`],
                  ['稼働開始時刻', selected.defaultStartTime || '--'],
                  ['現場勤怠', selected.clientAttendanceRequired ? 'あり' : 'なし'],
                  ['請求時の勤怠表添付', selected.attendanceFormat === 'company' ? '自社フォーマット' : selected.attendanceFormat === 'client_original' ? '現場データそのまま' : '不要'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              {/* 勤務情報 */}
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">勤務情報</div>
                {[
                  ['勤務地', selected.workLocation || '未設定'],
                  ['エリア', selected.area ? areaLabel[selected.area] || selected.area : '未設定'],
                  ...((selected.status === 'ended' || selected.status === 'ending_scheduled') && selected.endReason
                    ? [['終了理由', endReasonLabel[selected.endReason] || selected.endReason]]
                    : []),
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              {/* アクションボタン */}
              <div className="flex gap-2 flex-wrap">
                <button className="btn-outline flex-1 text-sm py-2" onClick={openEditModal}>編集</button>
                {(selectedDisplayTab === 'active' || selectedDisplayTab === 'ending_scheduled') && (
                  <button className="btn-outline flex-1 text-sm py-2" onClick={openExtendModal}>契約延長</button>
                )}
                {selectedDisplayTab === 'active' && (
                  <button
                    className="btn-outline flex-1 text-sm py-2 text-status-red-text border-status-red-text/30 hover:bg-status-red-bg"
                    onClick={openEndModal}
                  >
                    稼働終了
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 稼働終了モーダル */}
      {showEndModal && selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[200]" onClick={() => setShowEndModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] bg-card border border-border rounded-xl z-[201] shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-border/30">
              <h2 className="text-lg font-medium">稼働終了</h2>
              <button onClick={() => setShowEndModal(false)} className="text-secondary hover:text-primary text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-secondary mb-2">
                {selected.employee.lastName} {selected.employee.firstName}（{selected.client.name}）
              </div>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/30 cursor-pointer hover:bg-page transition-colors">
                <input type="radio" name="endMode" checked={endMode === 'scheduled'} onChange={() => setEndMode('scheduled')} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">契約期間通り終了</div>
                  <div className="text-xs text-secondary mt-0.5">
                    終了日: {formatDate(selected.endDate)}　→ ステータスが「終了予定」になります
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/30 cursor-pointer hover:bg-page transition-colors">
                <input type="radio" name="endMode" checked={endMode === 'immediate'} onChange={() => setEndMode('immediate')} className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">途中終了</div>
                  <div className="text-xs text-secondary mt-0.5 mb-2">契約期間より前に終了します</div>
                  {endMode === 'immediate' && (
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>
              </label>

              <div>
                <label className="block text-xs text-secondary mb-1">終了理由 <span className="text-status-red-text">*</span></label>
                <select
                  value={endReason}
                  onChange={e => setEndReason(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none bg-card appearance-none focus:border-primary"
                >
                  <option value="term_end">期間満了</option>
                  <option value="client_reason">クライアント都合により終了</option>
                  <option value="skill_shortage">本人都合 / 技術不足</option>
                  <option value="attendance_issue">本人都合 / 勤怠不良</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowEndModal(false)} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                <button
                  onClick={handleEndAssignment}
                  className="flex-1 text-sm py-2 rounded-md text-white bg-status-red-text hover:opacity-90 transition-opacity"
                >
                  {endMode === 'scheduled' ? '終了予定にする' : '稼働を終了する'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 契約延長モーダル */}
      {showExtendModal && selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[200]" onClick={() => setShowExtendModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] bg-card border border-border rounded-xl z-[201] shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-border/30">
              <h2 className="text-lg font-medium">契約延長</h2>
              <button onClick={() => setShowExtendModal(false)} className="text-secondary hover:text-primary text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-secondary">
                {selected.employee.lastName} {selected.employee.firstName}（{selected.client.name}）
              </div>
              <div className="text-sm">
                現在の終了日: <span className="font-medium">{formatDate(selected.endDate)}</span>
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">新しい終了日</label>
                <input
                  type="date"
                  value={extendDate}
                  onChange={e => setExtendDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowExtendModal(false)} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
                <button onClick={handleExtendAssignment} className="btn-primary flex-1 text-sm py-2">延長する</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 編集モーダル */}
      {showEditModal && selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[200]" onClick={() => setShowEditModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[680px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl z-[201] shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-border/30">
              <h2 className="text-lg font-medium">アサイン編集</h2>
              <button onClick={() => setShowEditModal(false)} className="text-secondary hover:text-primary text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* 社員情報（読み取り専用） */}
              <div className="card p-4 bg-page">
                <div className="text-sm font-medium mb-2">社員情報</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-secondary">社員:</span> {selected.employee.lastName} {selected.employee.firstName}</div>
                  <div><span className="text-secondary">クライアント:</span> {selected.client.name}</div>
                </div>
              </div>

              {/* 契約情報 */}
              <div className="card p-4">
                <div className="text-sm font-medium mb-3">契約情報</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">契約単価（月額） <span className="text-red-600">*</span></label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="650,000" value={editForm.contractPrice} onChange={e => setEditForm(f => ({ ...f, contractPrice: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">還元率</label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="72%" value={editForm.rewardRate} onChange={e => setEditForm(f => ({ ...f, rewardRate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">精算幅（下限）</label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="140" value={editForm.settlementLower} onChange={e => setEditForm(f => ({ ...f, settlementLower: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">精算幅（上限）</label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="180" value={editForm.settlementUpper} onChange={e => setEditForm(f => ({ ...f, settlementUpper: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">超過1時間あたり単価（円）</label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="未設定なら自動計算" value={editForm.overtimeRate} onChange={e => setEditForm(f => ({ ...f, overtimeRate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">控除1時間あたり単価（円）</label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="未設定なら自動計算" value={editForm.deductionRate} onChange={e => setEditForm(f => ({ ...f, deductionRate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">契約開始日 <span className="text-red-600">*</span></label>
                    <input type="date" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" value={editForm.contractStartDate} onChange={e => setEditForm(f => ({ ...f, contractStartDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">契約終了日 <span className="text-red-600">*</span></label>
                    <input type="date" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" value={editForm.contractEndDate} onChange={e => setEditForm(f => ({ ...f, contractEndDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">稼働開始時刻</label>
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none appearance-none focus:ring-1 focus:ring-primary/30" value={editForm.workStartTime} onChange={e => setEditForm(f => ({ ...f, workStartTime: e.target.value }))}>
                      <option value="8:00">8時00分</option>
                      <option value="8:30">8時30分</option>
                      <option value="9:00">9時00分</option>
                      <option value="9:30">9時30分</option>
                      <option value="10:00">10時00分</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">現場勤怠</label>
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none appearance-none focus:ring-1 focus:ring-primary/30" value={editForm.clientAttendanceRequired ? 'true' : 'false'} onChange={e => setEditForm(f => ({ ...f, clientAttendanceRequired: e.target.value === 'true' }))}>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">請求時の勤怠表添付</label>
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none appearance-none focus:ring-1 focus:ring-primary/30" value={editForm.attendanceFormat} onChange={e => setEditForm(f => ({ ...f, attendanceFormat: e.target.value }))}>
                      <option value="none">不要</option>
                      <option value="company">自社フォーマット</option>
                      <option value="client_original">現場データそのまま</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 勤務情報 */}
              <div className="card p-4">
                <div className="text-sm font-medium mb-3">勤務情報</div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">勤務地</label>
                    <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30" placeholder="大阪市中央区（常駐）" value={editForm.workLocation} onChange={e => setEditForm(f => ({ ...f, workLocation: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-2xs text-secondary mb-1">エリア</label>
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none appearance-none focus:ring-1 focus:ring-primary/30" value={editForm.area} onChange={e => setEditForm(f => ({ ...f, area: e.target.value }))}>
                      <option value="">選択してください</option>
                      <option value="tokyo">東京</option>
                      <option value="osaka">大阪</option>
                      <option value="nagoya">名古屋</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-2xs text-secondary mb-1">商流（自分たちが何次かを選択）</label>
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none appearance-none focus:ring-1 focus:ring-primary/30" value={editForm.supplyChain} onChange={e => setEditForm(f => ({ ...f, supplyChain: e.target.value }))}>
                      <option>一次請け</option>
                      <option>二次請け</option>
                      <option>三次請け</option>
                      <option>四次請け</option>
                      <option>それ以下</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-2xs text-secondary mb-1">備考</label>
                  <textarea className="w-full border border-border rounded-md px-3 py-2 text-sm outline-none resize-y focus:ring-1 focus:ring-primary/30" style={{ height: 60 }} placeholder="特記事項があれば入力" value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={handleEditSave} disabled={editSaving} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">{editSaving ? '保存中...' : '更新'}</button>
                <button onClick={() => setShowEditModal(false)} className="btn-outline flex-1 text-sm py-2">キャンセル</button>
              </div>
            </div>
          </div>
        </>
      )}

      <ToastUI />
    </div>
  );
}
