/**
 * 管理側 設定
 *
 * 料率設定 / 操作ログ / 外部連携。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface RateMaster {
  healthInsurance: number;
  employeePension: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTaxFixed: number;
  updatedAt?: string;
}

/* ---------- 操作ログ型定義 ---------- */

interface AuditLogRow {
  id: string;
  action: string;
  targetTable: string;
  targetId: string | null;
  oldValue: any;
  newValue: any;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface EditLogItem {
  id: string;
  workDate: string;
  modifiedFields: string[];
  oldClockIn: string | null;
  oldClockOut: string | null;
  oldBreakMinutes: number | null;
  newClockIn: string | null;
  newClockOut: string | null;
  newBreakMinutes: number | null;
  reason: string;
  objectionStatus: string;
  createdAt: string;
  employee: { lastName: string; firstName: string };
  adminUser: { employee: { lastName: string; firstName: string } | null } | null;
}

/* ---------- ヘルパー ---------- */

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtWorkDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatModification(log: EditLogItem): string {
  const parts: string[] = [];
  if (log.modifiedFields.includes('clockIn')) {
    parts.push(`出勤: ${fmtTime(log.oldClockIn)}→${fmtTime(log.newClockIn)}`);
  }
  if (log.modifiedFields.includes('clockOut')) {
    parts.push(`退勤: ${fmtTime(log.oldClockOut)}→${fmtTime(log.newClockOut)}`);
  }
  if (log.modifiedFields.includes('breakMinutes')) {
    parts.push(`休憩: ${log.oldBreakMinutes ?? '--'}→${log.newBreakMinutes ?? '--'}分`);
  }
  return parts.join('、') || log.modifiedFields.join('、');
}

/** アクション名を日本語に変換 */
const ACTION_LABELS: Record<string, string> = {
  login_success: 'ログイン',
  login_failure: 'ログイン失敗',
  logout: 'ログアウト',
  create: 'データ作成',
  update: 'データ更新',
  soft_delete: 'データ削除',
  restore: 'データ復元',
  'payroll.confirm': '給与確定',
  'payroll.edit': '給与修正',
  'expense.approve': '経費承認',
  'expense.reject': '経費却下',
  'user.role_change': '権限変更',
  'pii.mynumber_view': 'マイナンバー閲覧',
  'pii.bank_view': '口座情報閲覧',
  'export.csv': 'CSVエクスポート',
  'export.pdf': 'PDFエクスポート',
  'attendance.admin_edit': '勤怠修正',
};

/* ---------- 管理者管理用定数 ---------- */

interface UserRow {
  id: string;
  role: string;
  isLocked: boolean;
  lastLoginAt: string | null;
  employeeCode: string;
  lastName: string;
  firstName: string;
  email: string;
  employeeStatus: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'admin',
  manager: 'manager',
  member: 'member',
  employee: 'employee',
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-green-100 text-green-700',
  employee: 'bg-gray-100 text-gray-600',
};

const TABLE_LABELS: Record<string, string> = {
  employees: '社員',
  attendances: '勤怠',
  users: 'ユーザー',
  assignments: 'アサイン',
  payroll_records: '給与',
  expense_requests: '経費',
  clients: 'クライアント',
};

/** 追加モーダルの行コンポーネント（ロール選択 state を行ごとに持つ） */
function AddRow({ emp, promoting, onPromote }: {
  emp: any;
  promoting: boolean;
  onPromote: (userId: string, role: string) => void;
}) {
  const [role, setRole] = useState('member');
  const userId = emp.user?.id;
  return (
    <tr className="border-b border-border/20 hover:bg-[#FAFAF8]">
      <td className="px-3 py-2.5 text-sm font-mono">{emp.employeeCode}</td>
      <td className="px-3 py-2.5 text-sm font-medium whitespace-nowrap">{emp.lastName} {emp.firstName}</td>
      <td className="px-3 py-2.5 text-sm text-secondary">{emp.email}</td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-sm py-1 px-2 rounded border border-border/30 bg-card mr-2"
        >
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="member">member</option>
        </select>
        <button
          onClick={() => userId && onPromote(userId, role)}
          disabled={promoting || !userId}
          className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
        >
          {promoting ? '処理中...' : '昇格'}
        </button>
      </td>
    </tr>
  );
}

export default function AdminSettingsPage() {
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const tabs = canManageUsers
    ? ['料率設定', '操作ログ', '外部連携', '管理者管理', '更新']
    : ['料率設定', '操作ログ', '外部連携', '更新'];
  const { toast, ToastUI } = useToast();

  /* ---------- Google Drive 連携 ---------- */
  const [gdConnected, setGdConnected] = useState(false);
  const [gdEmail, setGdEmail] = useState('');
  const [gdLoading, setGdLoading] = useState(false);

  const fetchGdStatus = useCallback(async () => {
    try {
      const data = await apiClient<{ connected: boolean; email?: string }>('/settings/google-drive/status');
      setGdConnected(data.connected);
      setGdEmail(data.email || '');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchGdStatus();
  }, [fetchGdStatus]);

  useEffect(() => {
    if (searchParams.get('tab') === 'integrations' && searchParams.get('connected') === '1') {
      setActiveTab(2);
      fetchGdStatus();
      toast('Google Drive と連携しました');
    }
  }, [searchParams, fetchGdStatus, toast]);

  const handleGdConnect = async () => {
    try {
      const data = await apiClient<{ url: string }>('/settings/google-drive/connect');
      window.location.href = data.url;
    } catch (err: any) {
      toast(err?.message || 'OAuth URL の取得に失敗しました');
    }
  };

  const handleGdDisconnect = async () => {
    setGdLoading(true);
    try {
      await apiClient('/settings/google-drive/disconnect', { method: 'POST' });
      setGdConnected(false);
      setGdEmail('');
      toast('Google Drive 連携を解除しました');
    } catch (err: any) {
      toast(err?.message || '連携解除に失敗しました');
    } finally {
      setGdLoading(false);
    }
  };

  /* ---------- 料率マスタ ---------- */
  const [rateMaster, setRateMaster] = useState<RateMaster | null>(null);
  const [rateForm, setRateForm] = useState({
    healthInsurance: '',
    employeePension: '',
    employmentInsurance: '',
    incomeTax: '',
    residentTaxFixed: '',
  });
  const [rateSaving, setRateSaving] = useState(false);

  const fetchRateMaster = useCallback(async () => {
    try {
      const data = await apiClient<RateMaster>('/payroll/rate-master');
      setRateMaster(data);
      setRateForm({
        healthInsurance: String(data.healthInsurance * 100),
        employeePension: String(data.employeePension * 100),
        employmentInsurance: String(data.employmentInsurance * 100),
        incomeTax: String(data.incomeTax * 100),
        residentTaxFixed: String(data.residentTaxFixed),
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchRateMaster();
  }, [fetchRateMaster]);

  const handleSaveRateMaster = async () => {
    const health = parseFloat(rateForm.healthInsurance);
    const pension = parseFloat(rateForm.employeePension);
    const empIns = parseFloat(rateForm.employmentInsurance);
    const income = parseFloat(rateForm.incomeTax);
    const residentFixed = parseInt(rateForm.residentTaxFixed, 10);

    if ([health, pension, empIns, income].some((v) => isNaN(v) || v < 0 || v > 100)) {
      toast('料率は 0〜100(%) の範囲で入力してください');
      return;
    }
    if (isNaN(residentFixed) || residentFixed < 0) {
      toast('住民税は 0 以上の整数で入力してください');
      return;
    }

    setRateSaving(true);
    try {
      const updated = await apiClient<RateMaster>('/payroll/rate-master', {
        method: 'PATCH',
        body: JSON.stringify({
          healthInsurance: health / 100,
          employeePension: pension / 100,
          employmentInsurance: empIns / 100,
          incomeTax: income / 100,
          residentTaxFixed: residentFixed,
        }),
      });
      setRateMaster(updated);
      toast('料率を保存しました');
    } catch (err: any) {
      toast(err?.message || '保存に失敗しました');
    } finally {
      setRateSaving(false);
    }
  };

  /* ---------- 操作ログ ---------- */
  const [logTab, setLogTab] = useState<'all' | 'attendance'>('all');
  // 汎用操作ログ
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  // 勤怠修正ログ
  const [editLogs, setEditLogs] = useState<EditLogItem[]>([]);
  const [editLogsTotal, setEditLogsTotal] = useState(0);
  const [editLogsLoading, setEditLogsLoading] = useState(false);

  const fetchAuditLogs = useCallback(async (offset = 0, append = false) => {
    setAuditLoading(true);
    try {
      const data = await apiClient<{ rows: AuditLogRow[]; total: number }>(
        `/audit-logs?limit=50&offset=${offset}`,
      );
      setAuditLogs(prev => append ? [...prev, ...data.rows] : data.rows);
      setAuditTotal(data.total);
    } catch {
      /* ignore */
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const fetchEditLogs = useCallback(async (offset = 0, append = false) => {
    setEditLogsLoading(true);
    try {
      const data = await apiClient<{ items: EditLogItem[]; total: number }>(
        `/attendance/admin-edits/all?limit=50&offset=${offset}`,
      );
      setEditLogs(prev => append ? [...prev, ...data.items] : data.items);
      setEditLogsTotal(data.total);
    } catch {
      /* ignore */
    } finally {
      setEditLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      if (logTab === 'all') {
        fetchAuditLogs(0, false);
      } else {
        fetchEditLogs(0, false);
      }
    }
  }, [activeTab, logTab, fetchAuditLogs, fetchEditLogs]);

  /* ---------- 管理者管理 ---------- */
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (usersSearch) params.set('search', usersSearch);
      if (roleFilter) params.set('role', roleFilter);
      const res = await apiClient<{ data: UserRow[]; total: number }>(`/users?${params}`);
      setUsers(res.data);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }, [usersSearch, roleFilter]);

  useEffect(() => {
    if (activeTab === 3 && canManageUsers) fetchUsers();
  }, [activeTab, canManageUsers, fetchUsers]);

  const adminCount = users.filter((u) => u.role === 'admin').length;

  /* ---------- 追加モーダル ---------- */
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addPromoting, setAddPromoting] = useState<string | null>(null);

  // debounce 検索
  useEffect(() => {
    if (!addModalOpen || addSearch.length < 1) {
      setAddResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setAddLoading(true);
      try {
        const res = await apiClient<{ data: any[] }>(
          `/employees?search=${encodeURIComponent(addSearch)}&status=active&limit=20`,
        );
        // 既に管理ロールの社員を除外
        const adminIds = new Set(users.map((u) => u.employeeCode));
        setAddResults(
          (res.data || []).filter((emp: any) => !adminIds.has(emp.employeeCode)),
        );
      } catch { setAddResults([]); }
      finally { setAddLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [addSearch, addModalOpen, users]);

  const handlePromote = async (userId: string, role: string) => {
    setAddPromoting(userId);
    try {
      await apiClient(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      toast('ロールを変更しました');
      fetchUsers();
      setAddModalOpen(false);
      setAddSearch('');
    } catch (err: any) {
      toast(err?.message || '昇格に失敗しました');
    } finally {
      setAddPromoting(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    // セルフ降格の確認
    if (currentUser && userId === (currentUser as any).id && newRole !== 'admin') {
      const ok = window.confirm(
        '自分自身を管理者から降格すると、管理画面へのアクセス権を失う可能性があります。続けますか？',
      );
      if (!ok) return;
    }
    setChangingRoleId(userId);
    try {
      await apiClient(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      toast('ロールを変更しました');
      fetchUsers();
    } catch (err: any) {
      toast(err?.message || 'ロール変更に失敗しました');
    } finally {
      setChangingRoleId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">設定</h1>

      {/* タブ */}
      <div className="flex border-b border-border/40 mb-5">
        {tabs.map((tab, idx) => (
          <button key={tab} onClick={() => setActiveTab(idx)} className={`px-5 py-2.5 text-base border-b-2 transition-colors ${activeTab === idx ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* 料率設定 */}
      {activeTab === 0 && (
        <div className="card p-5 max-w-[720px]">
          <div className="text-md font-medium mb-1">給与計算の料率設定</div>
          <div className="text-xs text-secondary mb-4">
            ここで設定した料率がデフォルトとして給与計算に使用されます。
            社員ごとに上書きしたい場合は「社員詳細 → 契約・給与」タブで個別設定が可能です。
          </div>
          <div className="space-y-3">
            {[
              { key: 'healthInsurance', label: '健康保険料率（%）', unit: '%' },
              { key: 'employeePension', label: '厚生年金料率（%）', unit: '%' },
              { key: 'employmentInsurance', label: '雇用保険料率（%）', unit: '%' },
              { key: 'incomeTax', label: '所得税率（%）', unit: '%' },
              { key: 'residentTaxFixed', label: '住民税（固定額／円）', unit: '円' },
            ].map((row) => (
              <div key={row.key} className="flex items-center gap-3">
                <label className="text-sm text-secondary min-w-[180px]">{row.label}</label>
                <input
                  type="number"
                  step={row.key === 'residentTaxFixed' ? '1' : '0.01'}
                  value={(rateForm as any)[row.key]}
                  onChange={(e) =>
                    setRateForm((prev) => ({ ...prev, [row.key]: e.target.value }))
                  }
                  className="h-10 px-3 rounded-md border border-border/30 bg-card text-sm w-40 focus:border-primary focus:outline-none"
                />
                <span className="text-xs text-secondary">{row.unit}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4 mt-4 border-t border-border/20">
            <button
              onClick={handleSaveRateMaster}
              disabled={rateSaving}
              className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
            >
              {rateSaving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={fetchRateMaster}
              className="btn-outline text-sm py-2 px-4"
              disabled={rateSaving}
            >
              リセット
            </button>
            {rateMaster?.updatedAt && (
              <span className="text-xs text-secondary ml-auto self-center">
                最終更新: {new Date(rateMaster.updatedAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 操作ログ */}
      {activeTab === 1 && (
        <div>
          {/* サブタブ */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setLogTab('all')}
              className={`text-sm py-1.5 px-3 rounded-md transition-colors ${logTab === 'all' ? 'bg-primary text-white' : 'bg-card text-secondary hover:text-primary border border-border/30'}`}
            >
              すべて
            </button>
            <button
              onClick={() => setLogTab('attendance')}
              className={`text-sm py-1.5 px-3 rounded-md transition-colors ${logTab === 'attendance' ? 'bg-primary text-white' : 'bg-card text-secondary hover:text-primary border border-border/30'}`}
            >
              勤怠修正
            </button>
          </div>

          {/* すべての操作ログ */}
          {logTab === 'all' && (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    {['日時', 'ユーザー', '操作', '対象', '詳細'].map(h => (
                      <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length > 0 ? auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-2.5 text-sm text-secondary whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{log.userName || log.userEmail || '--'}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-page text-secondary">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-secondary">{TABLE_LABELS[log.targetTable] || log.targetTable}</td>
                      <td className="px-4 py-2.5 text-sm text-secondary max-w-[250px] truncate">
                        {log.action === 'login_success' ? 'ログイン成功' :
                         log.action === 'login_failure' ? 'ログイン失敗' :
                         log.newValue ? `${Object.keys(log.newValue).join(', ')} を変更` : '--'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-secondary text-sm">
                        {auditLoading ? '読み込み中...' : 'ログはありません'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {auditLogs.length < auditTotal && (
                <div className="px-5 py-3 text-center border-t border-border/20">
                  <button
                    onClick={() => fetchAuditLogs(auditLogs.length, true)}
                    disabled={auditLoading}
                    className="btn-outline text-sm py-1.5 px-4 disabled:opacity-50"
                  >
                    {auditLoading ? '読み込み中...' : `もっと見る（残り ${auditTotal - auditLogs.length} 件）`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 勤怠修正ログ */}
          {logTab === 'attendance' && (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    {['日時', '管理者', '対象社員', '勤怠日', '修正内容', '理由', '異議'].map(h => (
                      <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editLogs.length > 0 ? editLogs.map((log) => {
                    const adminName = log.adminUser?.employee
                      ? `${log.adminUser.employee.lastName} ${log.adminUser.employee.firstName}`
                      : '--';
                    const empName = `${log.employee.lastName} ${log.employee.firstName}`;
                    const objBadge = log.objectionStatus === 'objected'
                      ? 'badge-ng'
                      : log.objectionStatus === 'resolved'
                        ? 'badge-ok'
                        : 'badge-wait';
                    const objLabel = log.objectionStatus === 'objected'
                      ? '異議あり'
                      : log.objectionStatus === 'resolved'
                        ? '解決済み'
                        : 'なし';

                    return (
                      <tr key={log.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                        <td className="px-4 py-2.5 text-sm text-secondary whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                        <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{adminName}</td>
                        <td className="px-4 py-2.5 text-sm whitespace-nowrap">{empName}</td>
                        <td className="px-4 py-2.5 text-sm whitespace-nowrap">{fmtWorkDate(log.workDate)}</td>
                        <td className="px-4 py-2.5 text-sm">{formatModification(log)}</td>
                        <td className="px-4 py-2.5 text-sm text-secondary max-w-[200px] truncate">{log.reason}</td>
                        <td className="px-4 py-2.5"><span className={`badge ${objBadge}`}>{objLabel}</span></td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-secondary text-sm">
                        {editLogsLoading ? '読み込み中...' : '修正ログはありません'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {editLogs.length < editLogsTotal && (
                <div className="px-5 py-3 text-center border-t border-border/20">
                  <button
                    onClick={() => fetchEditLogs(editLogs.length, true)}
                    disabled={editLogsLoading}
                    className="btn-outline text-sm py-1.5 px-4 disabled:opacity-50"
                  >
                    {editLogsLoading ? '読み込み中...' : `もっと見る（残り ${editLogsTotal - editLogs.length} 件）`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 外部連携 */}
      {activeTab === 2 && (
        <div className="card p-5 max-w-[720px]">
          <div className="text-md font-medium mb-1">Google Drive 連携</div>
          <div className="text-xs text-secondary mb-4">
            Google Drive と連携すると、勤怠確定時にスプレッドシートが自動でDriveに保存されます。
          </div>

          {gdConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="badge badge-ok">連携中</span>
                <span className="text-sm">{gdEmail}</span>
              </div>
              <button
                onClick={handleGdDisconnect}
                disabled={gdLoading}
                className="btn-outline text-sm py-2 px-4 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
              >
                {gdLoading ? '解除中...' : '連携を解除'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGdConnect}
              className="btn-primary text-sm py-2 px-4"
            >
              Google Drive と連携する
            </button>
          )}
        </div>
      )}

      {/* 管理者管理 */}
      {activeTab === 3 && canManageUsers && (
        <div>
          {/* フィルタバー */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="氏名・社員番号で検索"
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
              className="h-10 px-3 rounded-md border border-border/30 bg-card text-sm w-64 focus:border-primary focus:outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-border/30 bg-card text-sm focus:border-primary focus:outline-none"
            >
              <option value="">すべてのロール</option>
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="member">member</option>
            </select>
            <button
              onClick={() => { setAddModalOpen(true); setAddSearch(''); setAddResults([]); }}
              className="btn-primary text-sm py-2 px-4 ml-auto"
            >
              + 追加
            </button>
          </div>

          {/* ユーザーテーブル */}
          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border">
                  {['社員番号', '氏名', 'メールアドレス', 'ロール', '最終ログイン', 'ステータス'].map((h) => (
                    <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? users.map((u) => {
                  const isOnlyAdmin = u.role === 'admin' && adminCount <= 1;
                  const isChanging = changingRoleId === u.id;
                  return (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-2.5 text-sm font-mono">{u.employeeCode}</td>
                      <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{u.lastName} {u.firstName}</td>
                      <td className="px-4 py-2.5 text-sm text-secondary">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={isOnlyAdmin || isChanging}
                          className={`text-sm py-1 px-2 rounded border border-border/30 bg-card focus:border-primary focus:outline-none ${isOnlyAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="admin">admin</option>
                          <option value="manager">manager</option>
                          <option value="member">member</option>
                        </select>
                        {isOnlyAdmin && (
                          <div className="text-[10px] text-secondary mt-0.5">最後の管理者</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-secondary whitespace-nowrap">
                        {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '--'}
                      </td>
                      <td className="px-4 py-2.5">
                        {u.isLocked ? (
                          <span className="badge badge-ng">ロック中</span>
                        ) : (
                          <span className="badge badge-ok">アクティブ</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-secondary text-sm">
                      {usersLoading ? '読み込み中...' : 'ユーザーが見つかりません'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-secondary">
            {users.length > 0 && `${users.length} 件のユーザー`}
          </div>
        </div>
      )}

      {/* 更新スケジュール */}
      {tabs[activeTab] === '更新' && (
        <div className="space-y-4">
          <p className="text-sm text-secondary mb-4">
            給与計算で使用するテーブル・料率は法改正に合わせて定期的な更新が必要です。下記のスケジュールに従い、開発側でコード更新＋デプロイを行ってください。
          </p>

          <div className="card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-start gap-3">
              <span className="badge badge-info whitespace-nowrap">毎年1月</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">源泉徴収税額表（甲欄）の改定</h3>
                <p className="text-xs text-secondary mt-1">国税庁が毎年12月頃に翌年の税額表を公表。1月支給分から適用。</p>
                <div className="mt-2 text-xs text-secondary space-y-0.5">
                  <div><span className="font-medium">対象:</span> <code className="bg-gray-100 px-1 rounded">apps/api/src/modules/payroll/tables/income-tax-table.ts</code></div>
                  <div><span className="font-medium">参照:</span> <span className="text-primary">国税庁「給与所得の源泉徴収税額表」</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-start gap-3">
              <span className="badge badge-info whitespace-nowrap">毎年3月</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">健康保険料率の改定（都道府県別）</h3>
                <p className="text-xs text-secondary mt-1">協会けんぽが毎年2月頃に翌年度の料率を公表。3月分（4月納付）から適用。</p>
                <div className="mt-2 text-xs text-secondary space-y-0.5">
                  <div><span className="font-medium">対象:</span> <code className="bg-gray-100 px-1 rounded">apps/api/src/modules/payroll/tables/standard-remuneration.ts</code> の <code className="bg-gray-100 px-1 rounded">HEALTH_INSURANCE_RATE</code></div>
                  <div><span className="font-medium">参照:</span> <span className="text-primary">協会けんぽ「都道府県毎の保険料額表」</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-start gap-3">
              <span className="badge badge-info whitespace-nowrap">毎年4月</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">標準報酬月額等級表の改定</h3>
                <p className="text-xs text-secondary mt-1">厚生労働省が等級の上限・区分を改定する場合がある。定時決定（算定基礎届）にも影響。</p>
                <div className="mt-2 text-xs text-secondary space-y-0.5">
                  <div><span className="font-medium">対象:</span> <code className="bg-gray-100 px-1 rounded">apps/api/src/modules/payroll/tables/standard-remuneration.ts</code> の <code className="bg-gray-100 px-1 rounded">STANDARD_REMUNERATION_TABLE</code></div>
                  <div><span className="font-medium">参照:</span> <span className="text-primary">日本年金機構「厚生年金保険の保険料額表」</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-blue-500">
            <div className="flex items-start gap-3">
              <span className="badge badge-info whitespace-nowrap">毎年4月</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">雇用保険料率の改定</h3>
                <p className="text-xs text-secondary mt-1">厚生労働省が毎年度の料率を決定。設定ページの「料率設定」タブから変更可能。</p>
                <div className="mt-2 text-xs text-secondary space-y-0.5">
                  <div><span className="font-medium">対象:</span> 設定 &gt; 料率設定タブ（UI操作で変更可能）</div>
                  <div><span className="font-medium">参照:</span> <span className="text-primary">厚生労働省「雇用保険料率について」</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-gray-400">
            <div className="flex items-start gap-3">
              <span className="badge badge-wait whitespace-nowrap">随時</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">厚生年金保険料率の改定</h3>
                <p className="text-xs text-secondary mt-1">2017年9月以降 18.3%（労使折半 9.15%）で固定中。法改正があれば変更。</p>
                <div className="mt-2 text-xs text-secondary space-y-0.5">
                  <div><span className="font-medium">対象:</span> <code className="bg-gray-100 px-1 rounded">apps/api/src/modules/payroll/tables/standard-remuneration.ts</code> の <code className="bg-gray-100 px-1 rounded">PENSION_RATE</code></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 border-l-4 border-l-gray-400">
            <div className="flex items-start gap-3">
              <span className="badge badge-wait whitespace-nowrap">随時</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium">祝日カレンダーの更新</h3>
                <p className="text-xs text-secondary mt-1">所定労働日数の計算に使用。npmパッケージが自動管理しているが、定期的に最新版に更新推奨。</p>
                <div className="mt-2 text-xs text-secondary space-y-0.5">
                  <div><span className="font-medium">対象:</span> <code className="bg-gray-100 px-1 rounded">@holiday-jp/holiday_jp</code> パッケージ</div>
                  <div><span className="font-medium">更新方法:</span> <code className="bg-gray-100 px-1 rounded">npx pnpm update @holiday-jp/holiday_jp</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 追加モーダル */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddModalOpen(false)} />
          <div className="relative bg-card rounded-lg shadow-xl w-full max-w-[600px] mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
              <h3 className="text-lg font-medium">管理者を追加</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-secondary hover:text-primary text-xl">×</button>
            </div>
            <div className="px-5 py-4">
              <input
                type="text"
                placeholder="社員名または社員番号で検索..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
                className="h-10 px-3 rounded-md border border-border/30 bg-page text-sm w-full focus:border-primary focus:outline-none"
              />
            </div>
            <div className="px-5 pb-5 overflow-y-auto flex-1">
              {addLoading ? (
                <div className="text-center text-secondary text-sm py-8">検索中...</div>
              ) : addResults.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {['社員番号', '氏名', 'メールアドレス', ''].map((h) => (
                        <th key={h} className="text-left text-xs text-secondary font-normal px-3 py-2 bg-[#FAFAFA]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {addResults.map((emp: any) => (
                      <AddRow
                        key={emp.id}
                        emp={emp}
                        promoting={addPromoting === emp.user?.id}
                        onPromote={handlePromote}
                      />
                    ))}
                  </tbody>
                </table>
              ) : addSearch.length > 0 ? (
                <div className="text-center text-secondary text-sm py-8">該当する社員が見つかりません</div>
              ) : (
                <div className="text-center text-secondary text-sm py-8">社員名を入力して検索してください</div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
