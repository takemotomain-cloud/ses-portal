/**
 * 社員側 申請メニュー
 *
 * UIモックのpage-applicationsを再現。
 * 申請メニュー（有給・交通費・届出）+ 申請履歴リスト。
 */

'use client';

import Link from 'next/link';

const applicationHistory: { id: string; type: string; detail: string; date: string; status: string }[] = [];

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: '確認中', class: 'badge-warn' },
  approved: { label: '承認済', class: 'badge-ok' },
  rejected: { label: '却下', class: 'badge-danger' },
};

export default function ApplicationsPage() {
  return (
    <div className="space-y-6">
      {/* 申請メニュー */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">申請メニュー</h2>
        <div className="space-y-2.5">
          {[
            {
              label: '有給休暇申請',
              desc: '全休・午前半休・午後半休・特別休暇',
              href: '/mypage/leave',
              color: 'bg-status-green-bg text-status-green-text',
            },
            {
              label: '交通費申請',
              desc: '通勤交通費の月次申請',
              href: '/mypage/expense',
              color: 'bg-status-blue-bg text-status-blue-text',
            },
            {
              label: '届出・証明書',
              desc: '在籍証明書・収入証明書の発行、休職届',
              href: '/more/documents',
              color: 'bg-status-amber-bg text-status-amber-text',
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="card flex items-center gap-4 px-4 py-4 hover:border-secondary/30 transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                <span className="text-lg font-bold">●</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-md font-semibold text-primary">{item.label}</div>
                <div className="text-sm text-secondary">{item.desc}</div>
              </div>
              <span className="text-xl text-secondary flex-shrink-0">›</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 申請履歴 */}
      <div>
        <h2 className="text-md font-bold text-primary mb-3">申請履歴</h2>
        {applicationHistory.length === 0 ? (
          <div className="card p-10 text-center text-secondary">申請履歴はありません</div>
        ) : (
          <div className="card p-0">
            {applicationHistory.map((item, idx) => {
              const st = statusConfig[item.status];
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-page transition-colors
                    ${idx < applicationHistory.length - 1 ? 'border-b border-border-light' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-md font-medium text-primary">{item.type}</span>
                      <span className={`badge ${st.class}`}>{st.label}</span>
                    </div>
                    <div className="text-sm text-secondary truncate">{item.detail}</div>
                  </div>
                  <div className="text-sm text-secondary flex-shrink-0">{item.date}</div>
                  <span className="text-lg text-secondary flex-shrink-0">›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
