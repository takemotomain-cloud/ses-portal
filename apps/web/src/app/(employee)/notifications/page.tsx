/**
 * お知らせ一覧ページ（API連携版）
 *
 * URL自動リンク化・画像表示対応。
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { LinkedText } from '@/components/ui/linked-text';

interface Notice {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  metadata?: { editId?: string; type?: string } | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days === 0) return '本日';
  if (days === 1) return '昨日';
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [showObjection, setShowObjection] = useState(false);
  const [objectionReason, setObjectionReason] = useState('');
  const [submittingObjection, setSubmittingObjection] = useState(false);
  const [objectedEditIds, setObjectedEditIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient<Notice[]>('/notifications?audience=employee')
      .then(setNotices)
      .catch(() => setNotices([]))
      .finally(() => setLoading(false));
  }, []);

  function handleClick(item: Notice) {
    setSelected(item);
    // 既読にする
    if (!item.isRead) {
      apiClient(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => {});
      setNotices(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page"
        >
          ‹
        </button>
        <h1 className="text-lg font-bold text-primary">お知らせ</h1>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div>
        ) : notices.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">お知らせはありません</div>
        ) : (
          <ul>
            {notices.map((item) => (
              <li
                key={item.id}
                onClick={() => handleClick(item)}
                className="flex items-start gap-3 px-4 py-3.5 border-b border-border-light last:border-b-0
                           cursor-pointer hover:bg-page transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-colors ${
                    !item.isRead ? 'bg-status-red-text' : 'bg-transparent'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-md text-primary font-medium truncate">{item.title}</p>
                  <p className="text-sm text-secondary mt-0.5 truncate">{item.body}</p>
                  {item.imageUrl && (
                    <span className="text-xs text-secondary/60 mt-0.5 inline-flex items-center gap-1">
                      📷 画像添付
                    </span>
                  )}
                </div>
                <span className="text-sm text-secondary flex-shrink-0">{timeAgo(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
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
              {timeAgo(selected.createdAt)}
            </span>
            <div className="text-md text-primary leading-relaxed">
              <LinkedText text={selected.body} />
            </div>
            {selected.imageUrl && (
              <div className="mt-4">
                <img
                  src={`${selected.imageUrl}`}
                  alt="添付画像"
                  className="w-full rounded-lg border border-border"
                />
              </div>
            )}

            {/* 異議ありボタン（管理者修正通知の場合のみ） */}
            {selected.metadata?.type === 'attendance_edit' && selected.metadata?.editId && (
              <div className="mt-4 border-t border-border pt-4">
                {objectedEditIds.has(selected.metadata.editId) ? (
                  <div className="text-sm text-status-amber-text font-medium text-center py-2">
                    異議申し立て済み
                  </div>
                ) : showObjection ? (
                  <div className="space-y-3">
                    <textarea
                      value={objectionReason}
                      onChange={e => setObjectionReason(e.target.value)}
                      placeholder="異議の理由を入力してください"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowObjection(false); setObjectionReason(''); }}
                        className="flex-1 py-2 rounded-lg border border-border text-sm text-secondary hover:bg-page"
                      >キャンセル</button>
                      <button
                        disabled={!objectionReason.trim() || submittingObjection}
                        onClick={async () => {
                          setSubmittingObjection(true);
                          try {
                            await apiClient(`/attendance/admin-edit/${selected.metadata!.editId}/object`, {
                              method: 'POST',
                              body: JSON.stringify({ reason: objectionReason.trim() }),
                            });
                            setObjectedEditIds(prev => new Set(prev).add(selected.metadata!.editId!));
                            setShowObjection(false);
                            setObjectionReason('');
                          } catch {
                            // エラー時は何もしない
                          } finally {
                            setSubmittingObjection(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-lg bg-status-red-text text-white text-sm font-medium hover:bg-status-red-text/90 disabled:opacity-50"
                      >{submittingObjection ? '送信中...' : '異議を送信'}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowObjection(true)}
                    className="w-full py-2.5 rounded-lg border-2 border-status-red-text text-status-red-text text-sm font-medium hover:bg-status-red-bg transition-colors"
                  >
                    異議あり
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => { setSelected(null); setShowObjection(false); setObjectionReason(''); }}
              className="mt-4 w-full py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
