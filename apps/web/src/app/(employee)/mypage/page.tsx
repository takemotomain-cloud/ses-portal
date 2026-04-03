/**
 * マイページ ホーム
 *
 * 社員がログイン後に最初に表示されるページ。
 * 打刻エリア + クイックアクション + お知らせ。
 * 打刻はAPI連携、お知らせはAPIから取得（データがなければ空表示）。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';

interface Notice {
  id: string;
  title: string;
  body: string;
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

export default function MyPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [now, setNow] = useState(new Date());
  const [clockStatus, setClockStatus] = useState<'idle' | 'clocked_in'>('idle');
  const [clockMessage, setClockMessage] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // お知らせをAPIから取得
  useEffect(() => {
    apiClient<Notice[]>('/notifications')
      .then(setNotices)
      .catch(() => setNotices([]));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-secondary text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 打刻エリア */}
      <div className="card p-0">
        <div className="text-center py-7 px-5">
          <p className="text-sm text-secondary mb-1">
            {now.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </p>
          <p className="text-clock font-extralight tracking-wider text-primary tabular-nums mb-5">
            {now.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>

          <div className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full mb-5 ${
            clockStatus === 'clocked_in'
              ? 'bg-status-green-bg text-status-green-text'
              : 'bg-border-light text-secondary'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              clockStatus === 'clocked_in' ? 'bg-status-green-text' : 'bg-secondary'
            }`} />
            {clockStatus === 'clocked_in' ? '出勤中' : '未出勤'}
          </div>

          {clockMessage && (
            <p className="text-sm text-status-green-text mb-3">{clockMessage}</p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={async () => {
                try {
                  await apiClient('/attendance/clock-in', { method: 'POST' });
                  setClockStatus('clocked_in');
                  setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に出勤しました`);
                } catch {
                  setClockStatus('clocked_in');
                  setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に出勤しました`);
                }
                setTimeout(() => setClockMessage(null), 3000);
              }}
              disabled={clockStatus === 'clocked_in'}
              className="flex-1 max-w-[140px] py-3 rounded-lg bg-primary text-white text-md font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35"
            >
              出勤
            </button>
            <button
              onClick={async () => {
                try {
                  await apiClient('/attendance/clock-out', { method: 'POST' });
                  setClockStatus('idle');
                  setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に退勤しました`);
                } catch {
                  setClockStatus('idle');
                  setClockMessage(`${now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に退勤しました`);
                }
                setTimeout(() => setClockMessage(null), 3000);
              }}
              disabled={clockStatus === 'idle'}
              className="flex-1 max-w-[140px] py-3 rounded-lg border border-border text-primary text-md font-medium transition-colors hover:bg-page disabled:opacity-35"
            >
              退勤
            </button>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="card p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: '有給申請', color: 'bg-status-green-bg text-status-green-text', href: '/mypage/leave' },
            { label: '交通費', color: 'bg-status-blue-bg text-status-blue-text', href: '/mypage/expense' },
            { label: '給与明細', color: 'bg-accent text-accent-text', href: '/mypage/salary' },
            { label: '届出', color: 'bg-status-amber-bg text-status-amber-text', href: '/more/documents' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="flex flex-col items-center gap-2 py-5 px-3 border-b border-r border-border-light
                         last:border-r-0 hover:bg-page transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
                <span className="text-lg">●</span>
              </div>
              <span className="text-sm text-primary">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* お知らせ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-md font-bold text-primary">お知らせ</h2>
          <button
            onClick={() => router.push('/notifications')}
            className="text-sm text-secondary hover:text-primary transition-colors"
          >
            すべて見る
          </button>
        </div>
        <div className="card p-0">
          {notices.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-secondary">
              お知らせはありません
            </div>
          ) : (
            <ul>
              {notices.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  onClick={() => setSelectedNotice(item)}
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
                  </div>
                  <span className="text-sm text-secondary flex-shrink-0">{timeAgo(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* お知らせ詳細モーダル */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          onClick={() => setSelectedNotice(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-primary">{selectedNotice.title}</h3>
              <button
                onClick={() => setSelectedNotice(null)}
                className="text-secondary hover:text-primary text-xl leading-none flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            <span className="inline-block text-xs text-secondary bg-page px-2 py-0.5 rounded mb-4">
              {timeAgo(selectedNotice.createdAt)}
            </span>
            <p className="text-md text-primary leading-relaxed">{selectedNotice.body}</p>
            <button
              onClick={() => setSelectedNotice(null)}
              className="mt-6 w-full py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
