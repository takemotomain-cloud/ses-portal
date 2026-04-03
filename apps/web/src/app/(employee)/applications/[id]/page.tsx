/**
 * 社員側 申請詳細ページ
 *
 * UIモックのpage-application-detailを再現。
 * ステータスバッジ + タイトル + 内容・経緯・承認者の詳細行。
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

/* ---------- 型定義 ---------- */
interface ApplicationDetail {
  id: string;
  type: string;
  content: string;
  status: 'approved' | 'pending' | 'rejected';
  timeline: string;
  approver: string | null;
}

/* ---------- ステータス表示設定 ---------- */
const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  approved: { label: '承認済', badgeClass: 'badge-ok' },
  pending:  { label: '確認中', badgeClass: 'badge-warn' },
  rejected: { label: '却下',   badgeClass: 'badge-danger' },
};

/* ---------- プレースホルダーデータ ---------- */
const detailMap: Record<string, ApplicationDetail> = {
  '1': {
    id: '1',
    type: '有給休暇',
    content: '2026年4月14日〜2026年4月15日',
    status: 'approved',
    timeline: '2026年3月28日申請 → 2026年3月31日承認',
    approver: '佐藤 一郎（管理部）',
  },
  '2': {
    id: '2',
    type: '交通費精算',
    content: '2026年2月分 — 18,420円',
    status: 'approved',
    timeline: '2026年3月5日申請 → 2026年3月8日承認',
    approver: '佐藤 一郎（管理部）',
  },
  '3': {
    id: '3',
    type: '住所変更届',
    content: '2026年1月20日申請',
    status: 'pending',
    timeline: '管理部にて確認中です',
    approver: null,
  },
};

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  const id = params.id as string;
  const detail = detailMap[id];

  if (!detail) {
    return (
      <div className="space-y-6">
        <div className="card p-10 text-center text-secondary">
          申請データが見つかりません
        </div>
        <button
          onClick={() => router.push('/applications')}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          ← 申請一覧に戻る
        </button>
      </div>
    );
  }

  const st = statusConfig[detail.status];

  return (
    <>
      <ToastUI />
      <div className="space-y-6">
        {/* 戻るリンク */}
        <button
          onClick={() => router.push('/applications')}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          ← 申請一覧に戻る
        </button>

        {/* 申請詳細カード */}
        <div className="card">
          {/* ステータスバッジ */}
          <div className="mb-3">
            <span className={`badge ${st.badgeClass}`}>{st.label}</span>
          </div>

          {/* タイトル */}
          <h2 className="text-base font-bold text-primary mb-4">{detail.type}</h2>

          {/* 詳細行 */}
          <div className="border-t border-border-light pt-4 space-y-0">
            {/* 内容 */}
            <div className="flex justify-between py-1.5 text-[13px]">
              <span className="text-secondary">内容</span>
              <span className="font-medium text-primary">{detail.content}</span>
            </div>

            {/* 経緯 */}
            <div className="flex justify-between py-1.5 text-[13px]">
              <span className="text-secondary">経緯</span>
              <span className="font-medium text-primary">{detail.timeline}</span>
            </div>

            {/* 承認者（存在する場合のみ） */}
            {detail.approver && (
              <div className="flex justify-between py-1.5 text-[13px]">
                <span className="text-secondary">承認者</span>
                <span className="font-medium text-primary">{detail.approver}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
