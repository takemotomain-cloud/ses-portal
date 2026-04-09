/**
 * 管理側 承認待ち（API連携版）
 *
 * DB上のleave_requests, expense_requests, change_requestsを取得し、
 * 承認/却下操作をAPIに反映する。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */
interface LeaveItem {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
}

interface ExpenseItem {
  id: string;
  targetMonth: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
  expenseItems?: { expenseDate: string; departure: string; destination: string; amount: number }[];
}

interface ChangeItem {
  id: string;
  changeType: string;
  oldValue: any;
  newValue: any;
  status: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
}

interface AttendanceCorrectionItem {
  id: string;
  attendanceId: string;
  originalClockIn: string | null;
  originalClockOut: string | null;
  originalBreakMinutes: number | null;
  newClockIn: string | null;
  newClockOut: string | null;
  newBreakMinutes: number | null;
  reason: string;
  status: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
  attendance: { workDate: string };
}

interface LoaItem {
  id: string;
  absenceType: string;
  startDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
  reason: string | null;
  fileName: string | null;
  filePath: string | null;
  status: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
}

interface DelayCertItem {
  id: string;
  targetDate: string;
  route: string | null;
  reason: string | null;
  fileName: string | null;
  filePath: string | null;
  status: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
}

interface YearendItem {
  id: string;
  fiscalYear: number;
  status: string;
  submittedAt: string;
  createdAt: string;
  employee: { lastName: string; firstName: string; employeeCode: string };
}

interface DoneItem {
  id: string;
  type: 'leave' | 'expense' | 'change' | 'attendance' | 'delay' | 'loa' | 'yearend';
  name: string;
  detail: string;
  approved: boolean;
  processedDate: string;
}

/* ---------- ヘルパー ---------- */
const leaveTypeLabel: Record<string, string> = {
  full_day: '全休',
  am_half: '午前半休',
  pm_half: '午後半休',
  special: '特別休暇',
};

const absenceTypeLabel: Record<string, string> = {
  injury: '傷病休職',
  childcare: '育児休業',
  nursing: '介護休業',
  other: 'その他',
};

const changeTypeLabel: Record<string, string> = {
  address: '住所変更',
  bank: '口座変更',
  dependent: '扶養変更',
  emergency: '緊急連絡先変更',
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtTime(iso: string | null) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}年${parseInt(mo)}月分`;
}

function fmtAmount(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}

/* ---------- コンポーネント ---------- */
export default function AdminApprovalsPage() {
  const { toast, ToastUI } = useToast();
  const [leaveItems, setLeaveItems] = useState<LeaveItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [changeItems, setChangeItems] = useState<ChangeItem[]>([]);
  const [correctionItems, setCorrectionItems] = useState<AttendanceCorrectionItem[]>([]);
  const [delayCertItems, setDelayCertItems] = useState<DelayCertItem[]>([]);
  const [loaItems, setLoaItems] = useState<LoaItem[]>([]);
  const [yearendItems, setYearendItems] = useState<YearendItem[]>([]);
  const [yearendRejectModal, setYearendRejectModal] = useState<YearendItem | null>(null);
  const [yearendRejectReason, setYearendRejectReason] = useState('');
  const [done, setDone] = useState<DoneItem[]>([]);
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  /* データ取得 */
  const fetchData = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const [leaves, expenses, changes, corrections, delayCerts, loas, yearends] = await Promise.all([
        apiClient<LeaveItem[]>('/leave/pending'),
        apiClient<ExpenseItem[]>('/expense/pending'),
        apiClient<ChangeItem[]>('/profile/change-requests/pending'),
        apiClient<AttendanceCorrectionItem[]>('/attendance/corrections/pending'),
        apiClient<DelayCertItem[]>('/delay-certificates/pending'),
        apiClient<LoaItem[]>('/leave-of-absence/pending'),
        apiClient<YearendItem[]>(`/yearend/pending/${currentYear}`),
      ]);
      setLeaveItems(leaves);
      setExpenseItems(expenses);
      setChangeItems(changes);
      setCorrectionItems(corrections);
      setDelayCertItems(delayCerts);
      setLoaItems(loas);
      setYearendItems(yearends);
    } catch (e: any) {
      console.error('Failed to fetch approvals:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* 有給 承認/却下 */
  async function handleLeave(item: LeaveItem, approved: boolean) {
    setProcessing(item.id);
    try {
      if (approved) {
        await apiClient(`/leave/${item.id}/approve`, { method: 'POST' });
      } else {
        await apiClient(`/leave/${item.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: '管理者判断により却下' }),
        });
      }
      setLeaveItems(prev => prev.filter(i => i.id !== item.id));
      setDone(prev => [{
        id: item.id,
        type: 'leave',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${fmtDate(item.startDate)}〜${fmtDate(item.endDate)}（${leaveTypeLabel[item.leaveType] || item.leaveType}・${item.days}日間）`,
        approved,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      toast(approved ? '承認しました' : '却下しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 経費 承認/却下 */
  async function handleExpense(item: ExpenseItem, approved: boolean) {
    setProcessing(item.id);
    try {
      if (approved) {
        await apiClient(`/expense/${item.id}/approve`, { method: 'POST' });
      } else {
        await apiClient(`/expense/${item.id}/reject`, { method: 'POST' });
      }
      setExpenseItems(prev => prev.filter(i => i.id !== item.id));
      setDone(prev => [{
        id: item.id,
        type: 'expense',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${fmtMonth(item.targetMonth)} 交通費 ${fmtAmount(item.totalAmount)}円`,
        approved,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      toast(approved ? '承認しました' : '却下しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 勤怠修正 承認/却下 */
  async function handleCorrection(item: AttendanceCorrectionItem, approved: boolean) {
    setProcessing(item.id);
    try {
      if (approved) {
        await apiClient(`/attendance/corrections/${item.id}/approve`, { method: 'POST' });
      } else {
        await apiClient(`/attendance/corrections/${item.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: '管理者判断により却下' }),
        });
      }
      setCorrectionItems(prev => prev.filter(i => i.id !== item.id));
      const wd = new Date(item.attendance.workDate);
      const changes: string[] = [];
      if (item.newClockIn) changes.push(`出勤: ${fmtTime(item.originalClockIn)}→${fmtTime(item.newClockIn)}`);
      if (item.newClockOut) changes.push(`退勤: ${fmtTime(item.originalClockOut)}→${fmtTime(item.newClockOut)}`);
      if (item.newBreakMinutes !== null) changes.push(`休憩: ${item.originalBreakMinutes}分→${item.newBreakMinutes}分`);
      setDone(prev => [{
        id: item.id,
        type: 'attendance',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${fmtDate(item.attendance.workDate)} ${changes.join(' / ')}`,
        approved,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      toast(approved ? '承認しました' : '却下しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 情報変更 承認/却下 */
  async function handleChange(item: ChangeItem, approved: boolean) {
    setProcessing(item.id);
    try {
      if (approved) {
        await apiClient(`/profile/change-requests/${item.id}/approve`, { method: 'POST' });
      } else {
        await apiClient(`/profile/change-requests/${item.id}/reject`, { method: 'POST' });
      }
      setChangeItems(prev => prev.filter(i => i.id !== item.id));
      const oldVal = item.oldValue as Record<string, any>;
      const newVal = item.newValue as Record<string, any>;
      let detail = changeTypeLabel[item.changeType] || item.changeType;
      if (item.changeType === 'address') {
        detail = `住所変更：${oldVal?.address || '—'} → ${newVal?.address || '—'}`;
      } else if (item.changeType === 'bank') {
        detail = `口座変更：${oldVal?.bankName || '—'} → ${newVal?.bankName || '—'}`;
      }
      setDone(prev => [{
        id: item.id,
        type: 'change',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail,
        approved,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      toast(approved ? '承認しました' : '却下しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 遅延証明書 確認 */
  async function handleDelayCert(item: DelayCertItem) {
    setProcessing(item.id);
    try {
      await apiClient(`/delay-certificates/${item.id}/confirm`, { method: 'POST' });
      setDelayCertItems(prev => prev.filter(i => i.id !== item.id));
      setDone(prev => [{
        id: item.id,
        type: 'delay',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `遅延証明書 ${fmtDate(item.targetDate)}${item.route ? ` (${item.route})` : ''}`,
        approved: true,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      toast('確認しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 休職届 承認/却下 */
  async function handleLoa(item: LoaItem, approved: boolean) {
    setProcessing(item.id);
    try {
      if (item.status === 'return_pending') {
        await apiClient(`/leave-of-absence/${item.id}/return-approve`, { method: 'POST' });
        setLoaItems(prev => prev.filter(i => i.id !== item.id));
        setDone(prev => [{
          id: item.id,
          type: 'loa',
          name: `${item.employee.lastName} ${item.employee.firstName}`,
          detail: `復職承認（${absenceTypeLabel[item.absenceType] || item.absenceType}）`,
          approved: true,
          processedDate: fmtDate(new Date().toISOString()),
        }, ...prev]);
        toast('復職を承認しました');
      } else if (approved) {
        await apiClient(`/leave-of-absence/${item.id}/approve`, { method: 'POST' });
        setLoaItems(prev => prev.filter(i => i.id !== item.id));
        setDone(prev => [{
          id: item.id,
          type: 'loa',
          name: `${item.employee.lastName} ${item.employee.firstName}`,
          detail: `休職承認（${absenceTypeLabel[item.absenceType] || item.absenceType}・${fmtDate(item.startDate)}〜${fmtDate(item.expectedReturnDate)}）`,
          approved: true,
          processedDate: fmtDate(new Date().toISOString()),
        }, ...prev]);
        toast('休職届を承認しました');
      } else {
        await apiClient(`/leave-of-absence/${item.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: '管理者判断により却下' }),
        });
        setLoaItems(prev => prev.filter(i => i.id !== item.id));
        setDone(prev => [{
          id: item.id,
          type: 'loa',
          name: `${item.employee.lastName} ${item.employee.firstName}`,
          detail: `休職却下（${absenceTypeLabel[item.absenceType] || item.absenceType}）`,
          approved: false,
          processedDate: fmtDate(new Date().toISOString()),
        }, ...prev]);
        toast('却下しました');
      }
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 年末調整 承認 */
  async function handleYearendApprove(item: YearendItem) {
    setProcessing(item.id);
    try {
      await apiClient(`/yearend/${item.id}/approve`, { method: 'POST' });
      setYearendItems(prev => prev.filter(i => i.id !== item.id));
      setDone(prev => [{
        id: item.id,
        type: 'yearend',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${item.fiscalYear}年 年末調整`,
        approved: true,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      toast('承認しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  /* 年末調整 差し戻し */
  async function handleYearendReject() {
    if (!yearendRejectModal || !yearendRejectReason.trim()) {
      toast('差し戻し理由を入力してください');
      return;
    }
    const item = yearendRejectModal;
    setProcessing(item.id);
    try {
      await apiClient(`/yearend/${item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: yearendRejectReason.trim() }),
      });
      setYearendItems(prev => prev.filter(i => i.id !== item.id));
      setDone(prev => [{
        id: item.id,
        type: 'yearend',
        name: `${item.employee.lastName} ${item.employee.firstName}`,
        detail: `${item.fiscalYear}年 年末調整（差し戻し）`,
        approved: false,
        processedDate: fmtDate(new Date().toISOString()),
      }, ...prev]);
      setYearendRejectModal(null);
      setYearendRejectReason('');
      toast('差し戻しました');
    } catch (e: any) {
      toast(e.message || 'エラーが発生しました');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-secondary">読み込み中...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-medium mb-5">承認待ち</h1>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">有給申請</div>
          <div className="text-3xl font-medium">{leaveItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">経費精算</div>
          <div className="text-3xl font-medium">{expenseItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">情報変更</div>
          <div className="text-3xl font-medium">{changeItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">勤怠修正</div>
          <div className="text-3xl font-medium">{correctionItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">遅延証明書</div>
          <div className="text-3xl font-medium">{delayCertItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">休職届</div>
          <div className="text-3xl font-medium">{loaItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">年末調整</div>
          <div className="text-3xl font-medium">{yearendItems.length}<span className="text-base font-normal text-secondary ml-1">件</span></div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-border/40 mb-5">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 0 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          未処理
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`px-5 py-2.5 text-base border-b-2 transition-colors
            ${activeTab === 1 ? 'text-primary font-medium border-primary' : 'text-secondary border-transparent hover:text-primary'}`}
        >
          処理済{done.length > 0 && ` (${done.length})`}
        </button>
      </div>

      {/* 未処理タブ */}
      {activeTab === 0 && (
        <div className="space-y-5">
          {/* 有給申請 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">有給申請</h3>
              <span className="text-sm text-secondary">{leaveItems.length}件</span>
            </div>
            <div className="card p-0">
              {leaveItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未処理の申請はありません</div>
              ) : (
                leaveItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < leaveItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                      <div className="text-sm text-secondary">
                        {fmtDate(item.startDate)}〜{fmtDate(item.endDate)}（{leaveTypeLabel[item.leaveType] || item.leaveType}・{item.days}日間）
                      </div>
                      {item.reason && <div className="text-xs text-secondary mt-0.5">理由: {item.reason}</div>}
                    </div>
                    <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.createdAt)}</div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleLeave(item, true)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">承認</button>
                      <button onClick={() => handleLeave(item, false)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-red-bg text-status-red-text hover:bg-[#FAD4D4] transition-colors disabled:opacity-50">却下</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 経費精算 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">経費精算</h3>
              <span className="text-sm text-secondary">{expenseItems.length}件</span>
            </div>
            <div className="card p-0">
              {expenseItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未処理の申請はありません</div>
              ) : (
                expenseItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < expenseItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                      <div className="text-sm text-secondary">
                        {fmtMonth(item.targetMonth)} 交通費 {fmtAmount(item.totalAmount)}円
                      </div>
                    </div>
                    <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.createdAt)}</div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleExpense(item, true)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">承認</button>
                      <button onClick={() => handleExpense(item, false)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-red-bg text-status-red-text hover:bg-[#FAD4D4] transition-colors disabled:opacity-50">却下</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 勤怠修正 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">勤怠修正</h3>
              <span className="text-sm text-secondary">{correctionItems.length}件</span>
            </div>
            <div className="card p-0">
              {correctionItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未処理の申請はありません</div>
              ) : (
                correctionItems.map((item, idx) => {
                  const changes: string[] = [];
                  if (item.newClockIn) changes.push(`出勤: ${fmtTime(item.originalClockIn)} → ${fmtTime(item.newClockIn)}`);
                  if (item.newClockOut) changes.push(`退勤: ${fmtTime(item.originalClockOut)} → ${fmtTime(item.newClockOut)}`);
                  if (item.newBreakMinutes !== null) changes.push(`休憩: ${item.originalBreakMinutes}分 → ${item.newBreakMinutes}分`);
                  return (
                    <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < correctionItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                        <div className="text-sm text-secondary">
                          {fmtDate(item.attendance.workDate)}の勤怠 — {changes.join(' / ')}
                        </div>
                        {item.reason && <div className="text-xs text-secondary mt-0.5">理由: {item.reason}</div>}
                      </div>
                      <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.createdAt)}</div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleCorrection(item, true)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">承認</button>
                        <button onClick={() => handleCorrection(item, false)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-red-bg text-status-red-text hover:bg-[#FAD4D4] transition-colors disabled:opacity-50">却下</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 情報変更 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">情報変更</h3>
              <span className="text-sm text-secondary">{changeItems.length}件</span>
            </div>
            <div className="card p-0">
              {changeItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未処理の申請はありません</div>
              ) : (
                changeItems.map((item, idx) => {
                  const oldVal = item.oldValue as Record<string, any>;
                  const newVal = item.newValue as Record<string, any>;
                  let detail = changeTypeLabel[item.changeType] || item.changeType;
                  if (item.changeType === 'address') {
                    detail = `住所変更：${oldVal?.address || '—'} → ${newVal?.address || '—'}`;
                  } else if (item.changeType === 'bank') {
                    detail = `口座変更：${oldVal?.bankName || '—'} → ${newVal?.bankName || '—'}`;
                  }
                  return (
                    <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < changeItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                        <div className="text-sm text-secondary">{detail}</div>
                      </div>
                      <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.createdAt)}</div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleChange(item, true)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">承認</button>
                        <button onClick={() => handleChange(item, false)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-red-bg text-status-red-text hover:bg-[#FAD4D4] transition-colors disabled:opacity-50">却下</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* 遅延証明書 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">遅延証明書</h3>
              <span className="text-sm text-secondary">{delayCertItems.length}件</span>
            </div>
            <div className="card p-0">
              {delayCertItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未確認の遅延証明書はありません</div>
              ) : (
                delayCertItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < delayCertItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                      <div className="text-sm text-secondary">
                        {fmtDate(item.targetDate)}
                        {item.route && ` — ${item.route}`}
                      </div>
                      {item.reason && <div className="text-xs text-secondary mt-0.5">{item.reason}</div>}
                      {item.fileName && item.filePath && (
                        <div className="mt-1">
                          <a
                            href={item.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            📎 {item.fileName}（クリックで表示）
                          </a>
                          {/\.(jpg|jpeg|png|gif|webp)$/i.test(item.fileName) && (
                            <a href={item.filePath} target="_blank" rel="noopener noreferrer">
                              <img
                                src={item.filePath}
                                alt="遅延証明書"
                                className="mt-1.5 max-w-[200px] max-h-[120px] rounded border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.createdAt)}</div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleDelayCert(item)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">確認</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 休職届 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">休職届</h3>
              <span className="text-sm text-secondary">{loaItems.length}件</span>
            </div>
            <div className="card p-0">
              {loaItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未処理の休職届はありません</div>
              ) : (
                loaItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < loaItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                      <div className="text-sm text-secondary">
                        {item.status === 'return_pending' ? (
                          <>復職届 — 復職日: {item.actualReturnDate ? fmtDate(item.actualReturnDate) : '未定'}</>
                        ) : (
                          <>{absenceTypeLabel[item.absenceType] || item.absenceType}・{fmtDate(item.startDate)}〜{fmtDate(item.expectedReturnDate)}</>
                        )}
                      </div>
                      {item.reason && <div className="text-xs text-secondary mt-0.5">理由: {item.reason}</div>}
                      {item.fileName && item.filePath && (
                        <div className="mt-1">
                          <a
                            href={item.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            📎 {item.fileName}（クリックで表示）
                          </a>
                          {item.fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.fileName) && (
                            <a href={item.filePath} target="_blank" rel="noopener noreferrer">
                              <img
                                src={item.filePath}
                                alt="添付ファイル"
                                className="mt-1.5 max-w-[200px] max-h-[120px] rounded border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.createdAt)}</div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {item.status === 'return_pending' ? (
                        <button onClick={() => handleLoa(item, true)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">復職承認</button>
                      ) : (
                        <>
                          <button onClick={() => handleLoa(item, true)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">承認</button>
                          <button onClick={() => handleLoa(item, false)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-red-bg text-status-red-text hover:bg-[#FAD4D4] transition-colors disabled:opacity-50">却下</button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 年末調整 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-medium">年末調整</h3>
              <span className="text-sm text-secondary">{yearendItems.length}件</span>
            </div>
            <div className="card p-0">
              {yearendItems.length === 0 ? (
                <div className="px-5 py-4 text-base text-secondary">未処理の年末調整はありません</div>
              ) : (
                yearendItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${idx < yearendItems.length - 1 ? 'border-b border-border/20' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium">{item.employee.lastName} {item.employee.firstName}</div>
                      <div className="text-sm text-secondary">{item.fiscalYear}年 年末調整</div>
                    </div>
                    <div className="text-sm text-secondary flex-shrink-0 mr-2">{fmtDate(item.submittedAt)}</div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleYearendApprove(item)} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-green-bg text-status-green-text hover:bg-[#C8EDDA] transition-colors disabled:opacity-50">承認</button>
                      <button onClick={() => { setYearendRejectModal(item); setYearendRejectReason(''); }} disabled={processing === item.id} className="px-3.5 py-1.5 rounded-md text-sm bg-status-red-bg text-status-red-text hover:bg-[#FAD4D4] transition-colors disabled:opacity-50">差し戻し</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 処理済タブ */}
      {activeTab === 1 && (
        <div className="card p-0">
          {done.length === 0 ? (
            <div className="px-5 py-4 text-base text-secondary">処理済の申請はありません</div>
          ) : (
            done.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-5 py-3.5 opacity-60 flex-wrap
                  ${idx < done.length - 1 ? 'border-b border-border/20' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium">{item.name}</div>
                  <div className="text-sm text-secondary">{item.detail}</div>
                </div>
                <div className="text-sm text-secondary flex-shrink-0 mr-2">{item.processedDate}</div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${item.approved ? 'bg-status-green-bg text-status-green-text' : 'bg-status-red-bg text-status-red-text'}`}>
                  {item.approved ? '承認済' : '却下済'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 年末調整 差し戻しモーダル */}
      {yearendRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setYearendRejectModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-primary">年末調整を差し戻し</h3>
            <div className="text-sm text-secondary">
              {yearendRejectModal.employee.lastName} {yearendRejectModal.employee.firstName}（{yearendRejectModal.fiscalYear}年）
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">差し戻し理由</label>
              <textarea
                rows={3}
                value={yearendRejectReason}
                onChange={(e) => setYearendRejectReason(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-primary resize-none"
                placeholder="修正が必要な箇所を入力してください"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setYearendRejectModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:bg-page transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleYearendReject}
                disabled={processing === yearendRejectModal.id || !yearendRejectReason.trim()}
                className="flex-1 py-2.5 rounded-lg bg-status-red-bg text-status-red-text text-sm font-semibold hover:bg-[#FAD4D4] transition-all disabled:opacity-50"
              >
                差し戻す
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
