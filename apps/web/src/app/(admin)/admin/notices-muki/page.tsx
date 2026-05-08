'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface EmployeeRow {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  contractType: string;
  employmentType: string;
  hireDate: string;
}

interface NoticeHistoryItem {
  id: string;
  documentType: string;
  fileName: string;
  driveViewLink: string | null;
  issuedAt: string;
  workflowStatus: 'issued' | 'sent' | 'waiting_ack' | 'completed';
  deliveryMethod: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  workflowNote: string | null;
}

interface MukiTargetRow {
  id: string;
  name: string;
  code: string;
  employmentType: string;
  hireDate: string;
  sixMonthDate: string;
  notice: NoticeHistoryItem | null;
}

interface IssuedNoticeRow {
  id: string;
  employeeId: string;
  name: string;
  issuedAt: string;
  driveViewLink: string | null;
  sixMonthDate: string;
  workflowStatus: 'issued' | 'sent' | 'waiting_ack' | 'completed';
  deliveryMethod: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  workflowNote: string | null;
}

const statusBadge: Record<'issued' | 'missing', { label: string; cls: string }> = {
  issued: { label: '発行済', cls: 'badge-ok' },
  missing: { label: '未発行', cls: 'badge-warn' },
};

const workflowBadge = {
  issued: { label: '発行済み', cls: 'badge-wait' },
  sent: { label: '送付済み', cls: 'badge-info' },
  waiting_ack: { label: '承諾待ち', cls: 'badge-warn' },
  completed: { label: '完了', cls: 'badge-ok' },
} as const;

function addMonths(dateString: string, months: number) {
  const date = new Date(dateString);
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function isNextMonth(date: Date) {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return date.getFullYear() === nextMonth.getFullYear() && date.getMonth() === nextMonth.getMonth();
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminNoticesMukiPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<MukiTargetRow[]>([]);
  const [issued, setIssued] = useState<IssuedNoticeRow[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<NoticeHistoryItem | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<'issued' | 'sent' | 'waiting_ack' | 'completed'>('issued');
  const [deliveryMethod, setDeliveryMethod] = useState('drive');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [acknowledgedAt, setAcknowledgedAt] = useState('');
  const [workflowNote, setWorkflowNote] = useState('');
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  const loadRows = async () => {
    const res = await apiClient<{ data: EmployeeRow[] }>('/employees?limit=100&status=active');
    const employees = res.data || [];

    const histories = await Promise.all(
      employees.map(async (emp) => ({
        employee: emp,
        history: await apiClient<NoticeHistoryItem[]>(`/notices/history/${emp.id}`).catch(() => []),
      })),
    );

    const targetRows: MukiTargetRow[] = [];
    const issuedRows: IssuedNoticeRow[] = [];

    for (const { employee, history } of histories) {
      const noticeOpen =
        history.find((item) => item.documentType === 'notice_open') || null;
      const sixMonthDate = addMonths(employee.hireDate, 6);

      if (noticeOpen) {
        issuedRows.push({
          id: noticeOpen.id,
          employeeId: employee.id,
          name: `${employee.lastName} ${employee.firstName}`,
          issuedAt: noticeOpen.issuedAt,
          driveViewLink: noticeOpen.driveViewLink,
          sixMonthDate: fmtDate(sixMonthDate.toISOString()),
          workflowStatus: noticeOpen.workflowStatus,
          deliveryMethod: noticeOpen.deliveryMethod,
          deliveredAt: noticeOpen.deliveredAt,
          acknowledgedAt: noticeOpen.acknowledgedAt,
          workflowNote: noticeOpen.workflowNote,
        });
      }

      if (employee.contractType !== 'indefinite' && isNextMonth(sixMonthDate)) {
        targetRows.push({
          id: employee.id,
          name: `${employee.lastName} ${employee.firstName}`,
          code: employee.employeeCode,
          employmentType: employee.employmentType,
          hireDate: fmtDate(employee.hireDate),
          sixMonthDate: fmtDate(sixMonthDate.toISOString()),
          notice: noticeOpen,
        });
      }
    }

    setTargets(targetRows);
    setIssued(issuedRows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadRows();
      } catch {
        if (!cancelled) {
          setTargets([]);
          setIssued([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNotice) return;
    setWorkflowStatus(selectedNotice.workflowStatus || 'issued');
    setDeliveryMethod(selectedNotice.deliveryMethod || 'drive');
    setDeliveredAt(selectedNotice.deliveredAt ? selectedNotice.deliveredAt.slice(0, 10) : '');
    setAcknowledgedAt(selectedNotice.acknowledgedAt ? selectedNotice.acknowledgedAt.slice(0, 10) : '');
    setWorkflowNote(selectedNotice.workflowNote || '');
  }, [selectedNotice]);

  const filteredIssued = useMemo(
    () => issued.filter((row) => row.name.includes(search)),
    [issued, search],
  );

  const saveWorkflow = async () => {
    if (!selectedNotice) return;
    setSavingWorkflow(true);
    try {
      await apiClient(`/notices/${selectedNotice.id}/workflow`, {
        method: 'PATCH',
        body: JSON.stringify({
          workflowStatus,
          deliveryMethod,
          deliveredAt: deliveredAt || null,
          acknowledgedAt: acknowledgedAt || null,
          workflowNote: workflowNote || null,
        }),
      });
      await loadRows();
      setSelectedNotice(null);
    } finally {
      setSavingWorkflow(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知書（無期転換）</h1>
        <button
          className="btn-primary text-sm py-2"
          onClick={() => router.push('/admin/notices-muki/new')}
        >
          新規発行
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">
          来月で6ヶ月を迎える有期雇用社員
          <span className="ml-2 text-sm text-secondary font-normal">{targets.length}名</span>
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
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
                  </td>
                </tr>
              ) : targets.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
                  </td>
                </tr>
              ) : (
                targets.map((target) => {
                  const badge = target.notice ? statusBadge.issued : statusBadge.missing;
                  return (
                    <tr key={target.id} className="border-b border-border/20 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-2.5 text-base font-medium">{target.name}</td>
                      <td className="px-4 py-2.5 text-base">{target.code}</td>
                      <td className="px-4 py-2.5 text-base">{target.employmentType}</td>
                      <td className="px-4 py-2.5 text-base">{target.hireDate}</td>
                      <td className="px-4 py-2.5 text-base">{target.sixMonthDate}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                          {target.notice && (
                            <span className={`badge ${workflowBadge[target.notice.workflowStatus].cls}`}>
                              {workflowBadge[target.notice.workflowStatus].label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {target.notice?.driveViewLink ? (
                            <a
                              href={target.notice.driveViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline text-xs py-1 px-2.5"
                            >
                              Driveで開く
                            </a>
                          ) : (
                            <button
                              onClick={() => router.push('/admin/notices-muki/new')}
                              className="btn-primary text-xs py-1 px-2.5"
                            >
                              発行画面
                            </button>
                          )}
                          {target.notice && (
                            <button
                              onClick={() => setSelectedNotice(target.notice)}
                              className="btn-outline text-xs py-1 px-2.5"
                            >
                              進捗更新
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
          {loading ? (
            <div className="card px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
          ) : filteredIssued.length === 0 ? (
            <div className="card px-4 py-8 text-center text-sm text-secondary">データはありません</div>
          ) : (
            filteredIssued.map((row) => (
              <div key={row.id} className="card">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-base font-medium">{row.name}</div>
                    <div className="text-xs text-secondary mt-1">
                      発行日 {fmtDate(row.issuedAt)} / 無期転換日 {row.sixMonthDate}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`badge ${workflowBadge[row.workflowStatus].cls}`}>
                        {workflowBadge[row.workflowStatus].label}
                      </span>
                      {row.deliveryMethod && (
                        <span className="text-xs text-secondary">方法: {row.deliveryMethod}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {row.driveViewLink ? (
                      <a
                        href={row.driveViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        Driveで開く
                      </a>
                    ) : (
                      <span className="badge badge-wait">Drive未連携</span>
                    )}
                    <button
                      onClick={() =>
                        setSelectedNotice({
                          id: row.id,
                          documentType: 'notice_open',
                          fileName: `${row.name} 労働条件通知書`,
                          driveViewLink: row.driveViewLink,
                          issuedAt: row.issuedAt,
                          workflowStatus: row.workflowStatus,
                          deliveryMethod: row.deliveryMethod,
                          deliveredAt: row.deliveredAt,
                          acknowledgedAt: row.acknowledgedAt,
                          workflowNote: row.workflowNote,
                        })
                      }
                      className="btn-outline text-xs py-1 px-2.5"
                    >
                      進捗更新
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-medium">通知書進捗の更新</div>
                <div className="text-xs text-secondary mt-1">{selectedNotice.fileName}</div>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="text-sm text-secondary hover:text-foreground"
              >
                閉じる
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-secondary mb-1">進捗ステータス</label>
                <select
                  value={workflowStatus}
                  onChange={(e) => setWorkflowStatus(e.target.value as typeof workflowStatus)}
                  className="input"
                >
                  <option value="issued">発行済み</option>
                  <option value="sent">送付済み</option>
                  <option value="waiting_ack">承諾待ち</option>
                  <option value="completed">完了</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-secondary mb-1">回収・送付方法</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="input"
                >
                  <option value="drive">Drive共有</option>
                  <option value="email">メール送付</option>
                  <option value="paper">紙受領</option>
                  <option value="post">郵送</option>
                  <option value="other">その他</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-secondary mb-1">送付日</label>
                  <input
                    type="date"
                    value={deliveredAt}
                    onChange={(e) => setDeliveredAt(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary mb-1">承諾日</label>
                  <input
                    type="date"
                    value={acknowledgedAt}
                    onChange={(e) => setAcknowledgedAt(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-secondary mb-1">メモ</label>
                <textarea
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                  className="input min-h-[96px]"
                  placeholder="受領済み、返送待ち など"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setSelectedNotice(null)}
                className="btn-outline text-sm py-2"
              >
                キャンセル
              </button>
              <button
                onClick={saveWorkflow}
                disabled={savingWorkflow}
                className="btn-primary text-sm py-2 disabled:opacity-50"
              >
                {savingWorkflow ? '保存中...' : '更新する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
