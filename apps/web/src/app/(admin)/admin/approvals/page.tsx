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

interface DoneItem {
  id: string;
  type: 'leave' | 'expense' | 'change';
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

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}年${parseInt(mo)}月分`;
}

function fmtAmount(n: number) {
  return n.toLocaleString();
}

/* ---------- コンポーネント ---------- */
export default function AdminApprovalsPage() {
  const { toast, ToastUI } = useToast();
  const [leaveItems, setLeaveItems] = useState<LeaveItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [changeItems, setChangeItems] = useState<ChangeItem[]>([]);
  const [done, setDone] = useState<DoneItem[]>([]);
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  /* データ取得 */
  const fetchData = useCallback(async () => {
    try {
      const [leaves, expenses, changes] = await Promise.all([
        apiClient<LeaveItem[]>('/leave/pending'),
        apiClient<ExpenseItem[]>('/expense/pending'),
        apiClient<ChangeItem[]>('/profile/change-requests/pending'),
      ]);
      setLeaveItems(leaves);
      setExpenseItems(expenses);
      setChangeItems(changes);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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

      <ToastUI />
    </div>
  );
}
