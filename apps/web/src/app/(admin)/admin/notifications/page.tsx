/**
 * 管理画面 通知一覧
 *
 * 自分（管理者）宛の通知を表示する。
 * 退職アカウント停止・申請通知などのシステム通知を確認するために使用。
 *
 * 社員側 /notifications と同じAPI（GET /notifications）を使用するが、
 * 管理画面のレイアウトに合わせて表示を調整。
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { LinkedText } from '@/components/ui/linked-text';
import { useToast } from '@/components/ui/toast';

interface Notice {
  id: string;
  title: string;
  body: string;
  category?: string | null;
  imageUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

const categoryLabel: Record<string, { label: string; cls: string }> = {
  system: { label: 'システム', cls: 'bg-status-amber-bg text-status-amber-text' },
  announcement: { label: 'お知らせ', cls: 'bg-status-blue-bg text-status-blue-text' },
};

export default function AdminNotificationsPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notice | null>(null);
  const { toast, ToastUI } = useToast();

  const fetchNotices = () => {
    setLoading(true);
    apiClient<Notice[]>('/notifications?limit=50&audience=admin')
      .then(setNotices)
      .catch(() => setNotices([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const unreadCount = notices.filter(n => !n.isRead).length;

  function handleClick(item: Notice) {
    setSelected(item);
    if (!item.isRead) {
      apiClient(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => {});
      setNotices(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    try {
      await apiClient('/notifications/read-all?audience=admin', { method: 'POST' });
      setNotices(prev => prev.map(n => ({ ...n, isRead: true })));
      toast('すべて既読にしました');
    } catch (err: any) {
      toast(err?.message || '既読化に失敗しました');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知</h1>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="text-sm px-3 py-2 border border-border rounded-md text-secondary hover:bg-page disabled:opacity-30 disabled:cursor-not-allowed"
        >
          すべて既読にする
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
        ) : notices.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">通知はありません</div>
        ) : (
          <ul>
            {notices.map((item) => {
              const cat = item.category ? categoryLabel[item.category] : null;
              return (
                <li
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className="flex items-start gap-3 px-5 py-4 border-b border-border-light last:border-b-0
                             cursor-pointer hover:bg-page transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-colors ${
                      !item.isRead ? 'bg-status-red-text' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {cat && (
                        <span className={`text-2xs px-1.5 py-px rounded ${cat.cls}`}>
                          {cat.label}
                        </span>
                      )}
                      <p className={`text-base truncate ${!item.isRead ? 'font-medium text-primary' : 'text-secondary'}`}>
                        {item.title}
                      </p>
                    </div>
                    <p className="text-sm text-secondary truncate">{item.body}</p>
                  </div>
                  <span className="text-xs text-secondary flex-shrink-0 mt-1">
                    {fmtDateTime(item.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-primary">{selected.title}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-secondary hover:text-primary text-xl leading-none flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            <span className="inline-block text-xs text-secondary bg-page px-2 py-0.5 rounded mb-4">
              {fmtDateTime(selected.createdAt)}
            </span>
            <div className="text-md text-primary leading-relaxed whitespace-pre-wrap">
              <LinkedText text={selected.body} />
            </div>
            {selected.imageUrl && (
              <div className="mt-4">
                <img
                  src={selected.imageUrl}
                  alt="添付画像"
                  className="w-full rounded-lg border border-border"
                />
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
