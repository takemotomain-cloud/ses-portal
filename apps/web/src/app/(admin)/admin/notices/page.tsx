/**
 * 管理側 通知書（入社前）
 *
 * 採用内定通知書 + 労働条件通知書。
 * 期間の定めなし→無期雇用型表示に動的切替。
 */

'use client';

import { useState } from 'react';

const demoNotices: { id: string; name: string; type: string; status: string; date: string; laborIssued: boolean }[] = [];

const statusBadge: Record<string, { label: string; cls: string }> = {
  draft: { label: '下書き', cls: 'badge-wait' },
  sent: { label: '送付済', cls: 'badge-info' },
};

export default function AdminNoticesPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">通知書（入社前）</h1>
        <button className="btn-primary text-sm py-2">新規作成</button>
      </div>

      <div className="card p-0">
        {demoNotices.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div>
        ) : demoNotices.map((n, idx) => (
          <div key={n.id} className={`px-5 py-4 ${idx < demoNotices.length - 1 ? 'border-b border-border/20' : ''}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="text-lg font-medium">{n.name}</div>
              <span className="text-sm text-secondary">{n.date}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 p-2.5 bg-page rounded-lg">
                <span className="text-sm">採用内定通知書</span>
                <span className={`badge ${statusBadge[n.status].cls}`}>{statusBadge[n.status].label}</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-page rounded-lg">
                <span className="text-sm">労働条件通知書</span>
                {n.laborIssued ? (
                  <span className="badge badge-info">送付済</span>
                ) : (
                  <button className="btn-primary text-xs py-1 px-2.5">発行する</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
