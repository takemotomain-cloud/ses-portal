'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface EmployeeRow {
  id: string;
  lastName: string;
  firstName: string;
  contractType: string;
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

interface NoticeRow {
  id: string;
  name: string;
  offer: NoticeHistoryItem | null;
  labor: NoticeHistoryItem | null;
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

const deliveryMethodLabel: Record<string, string> = {
  drive: 'Drive共有',
  email: 'メール送付',
  paper: '紙受領',
  post: '郵送',
  other: 'その他',
};

function fmtDate(iso?: string | null) {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

async function fetchNoticeRows() {
  const res = await apiClient<{ data: EmployeeRow[] }>('/employees?limit=100&status=active');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const targets = (res.data || [])
    .filter((emp) => new Date(emp.hireDate) >= cutoff)
    .sort((a, b) => new Date(a.hireDate).getTime() - new Date(b.hireDate).getTime());

  const historiesByEmployee: Record<string, NoticeHistoryItem[]> = await apiClient<Record<string, NoticeHistoryItem[]>>(
    '/notices/histories',
    {
      method: 'POST',
      body: JSON.stringify({ employeeIds: targets.map((emp) => emp.id) }),
    },
  ).catch(() => ({}));

  return targets.map((emp) => {
    const history = historiesByEmployee[emp.id] || [];
    const offer =
      history.find((item) => item.documentType === 'offer') || null;
    const labor =
      history.find((item) => item.documentType === 'notice_fixed') ||
      history.find((item) => item.documentType === 'notice_open') ||
      null;

    return {
      id: emp.id,
      name: `${emp.lastName} ${emp.firstName}`,
      offer,
      labor,
    };
  });
}

export default function AdminNoticesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<NoticeHistoryItem | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<'issued' | 'sent' | 'waiting_ack' | 'completed'>('issued');
  const [deliveryMethod, setDeliveryMethod] = useState('drive');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [acknowledgedAt, setAcknowledgedAt] = useState('');
  const [workflowNote, setWorkflowNote] = useState('');
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchNoticeRows();

        if (!cancelled) {
          setRows(data);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
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

  const reloadRows = async () => {
    setRows(await fetchNoticeRows());
  };

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
      await reloadRows();
      setSelectedNotice(null);
    } finally {
      setSavingWorkflow(false);
    }
  };

  const filtered = useMemo(
    () => rows.filter((row) => row.name.includes(search)),
    [rows, search],
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知書（入社前）</h1>
        <button
          className="btn-primary text-sm py-2"
          onClick={() => router.push('/admin/notices/new')}
        >
          新規発行
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="氏名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full max-w-xs"
        />
        <span className="text-sm text-secondary">{filtered.length}名</span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="card px-4 py-8 text-center text-sm text-secondary">
            データはありません
          </div>
        ) : (
          filtered.map((row) => {
            const offerBadge = row.offer ? statusBadge.issued : statusBadge.missing;
            const laborBadge = row.labor ? statusBadge.issued : statusBadge.missing;

            return (
              <div key={row.id} className="card">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-base font-bold min-w-[100px]">{row.name}</div>

                  <div className="flex items-center gap-3 bg-[#FAFAFA] rounded-lg p-3 flex-wrap">
                    <span className="text-sm">採用内定通知書</span>
                    <span className={`badge ${offerBadge.cls}`}>{offerBadge.label}</span>
                    <span className="text-xs text-secondary">
                      {row.offer ? fmtDate(row.offer.issuedAt) : '未発行'}
                    </span>
                    {row.offer && (
                      <span className={`badge ${workflowBadge[row.offer.workflowStatus].cls}`}>
                        {workflowBadge[row.offer.workflowStatus].label}
                      </span>
                    )}
                    {row.offer?.driveViewLink ? (
                      <a
                        href={row.offer.driveViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        Driveで開く
                      </a>
                    ) : (
                      <button
                        onClick={() => router.push('/admin/notices/new')}
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        発行画面
                      </button>
                    )}
                    {row.offer && (
                      <button
                        onClick={() => setSelectedNotice(row.offer)}
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        進捗更新
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-[#FAFAFA] rounded-lg p-3 flex-wrap">
                    <span className="text-sm">労働条件通知書</span>
                    <span className={`badge ${laborBadge.cls}`}>{laborBadge.label}</span>
                    <span className="text-xs text-secondary">
                      {row.labor ? fmtDate(row.labor.issuedAt) : '未発行'}
                    </span>
                    {row.labor && (
                      <span className={`badge ${workflowBadge[row.labor.workflowStatus].cls}`}>
                        {workflowBadge[row.labor.workflowStatus].label}
                      </span>
                    )}
                    {row.labor?.driveViewLink ? (
                      <a
                        href={row.labor.driveViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        Driveで開く
                      </a>
                    ) : (
                      <button
                        onClick={() => router.push('/admin/notices/new')}
                        className="btn-primary text-xs py-1 px-2.5"
                      >
                        発行画面
                      </button>
                    )}
                    {row.labor && (
                      <button
                        onClick={() => setSelectedNotice(row.labor)}
                        className="btn-outline text-xs py-1 px-2.5"
                      >
                        進捗更新
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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
                  placeholder="メール送付済み、先方確認待ち など"
                />
              </div>

              <div className="rounded-lg bg-[#FAFAFA] p-3 text-xs text-secondary">
                現在: {workflowBadge[selectedNotice.workflowStatus].label}
                {selectedNotice.deliveryMethod && ` / ${deliveryMethodLabel[selectedNotice.deliveryMethod] || selectedNotice.deliveryMethod}`}
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
