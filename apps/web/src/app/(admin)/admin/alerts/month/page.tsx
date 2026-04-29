/**
 * 管理側 今月のアラート
 *
 * HTMLプロトタイプ仕様を再現。
 * 打刻漏れTOP10 + 稼働時間ワーストTOP10 + 欠勤TOP10。
 * テーブルレイアウト使用。
 */

'use client';

import { useToast } from '@/components/ui/toast';

interface MissedEntry {
  name: string;
  client: string;
  missedCount: number;
  correctionCount: number;
}

interface WorkHoursEntry {
  name: string;
  client: string;
  billingRange: string;
  actual: number;
  achievementRate: number;
  status: 'warning' | 'danger' | 'ok';
}

interface AbsenceEntry {
  name: string;
  client: string;
  absenceDays: number;
  recentReason: string;
}

const missedTop: MissedEntry[] = [];
const workHoursWorst: WorkHoursEntry[] = [];
const absenceTop: AbsenceEntry[] = [];

const today = new Date();
const monthStr = `${today.getFullYear()}年${today.getMonth() + 1}月`;

function statusBadge(status: 'warning' | 'danger' | 'ok') {
  const map = {
    danger: { label: '要対応', cls: 'bg-status-red-bg text-status-red-text' },
    warning: { label: '注意', cls: 'bg-status-amber-bg text-status-amber-text' },
    ok: { label: '正常', cls: 'bg-status-green-bg text-status-green-text' },
  };
  const { label, cls } = map[status];
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function AlertsMonthPage() {
  const { toast, ToastUI } = useToast();

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">今月のアラート</h1>
        <span className="text-sm text-secondary">{monthStr}</span>
      </div>

      {/* Section 1: 打刻漏れ TOP10 */}
      <div className="mb-6">
        <h2 className="text-md font-medium text-status-red-text mb-1">打刻漏れ TOP10</h2>
        <p className="text-sm text-secondary mb-3">今月の未打刻・修正回数順</p>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] w-10">#</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働先</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">未打刻回数</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">修正申請回数</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">合計</th>
              </tr>
            </thead>
            <tbody>
              {missedTop.length === 0 ? (
                <tr><td colSpan={6}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
              ) : missedTop.map((item, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  <td className="px-4 py-2.5 text-base text-secondary">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{item.name}</td>
                  <td className="px-4 py-2.5 text-base">{item.client}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{item.missedCount}回</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{item.correctionCount}回</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums font-bold">{item.missedCount + item.correctionCount}回</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: 稼働時間 ワースト TOP10 */}
      <div className="mb-6">
        <h2 className="text-md font-medium text-status-amber-text mb-1">稼働時間 ワースト TOP10</h2>
        <p className="text-sm text-secondary mb-3">精算幅下限に対する達成率が低い順</p>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] w-10">#</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働先</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">精算幅</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">実績</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">達成率</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {workHoursWorst.length === 0 ? (
                <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
              ) : workHoursWorst.map((item, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  <td className="px-4 py-2.5 text-base text-secondary">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{item.name}</td>
                  <td className="px-4 py-2.5 text-base">{item.client}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{item.billingRange}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums">{item.actual}h</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums font-bold">{item.achievementRate}%</td>
                  <td className="px-4 py-2.5">{statusBadge(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: 欠勤 TOP10 */}
      <div>
        <h2 className="text-md font-medium mb-1">欠勤 TOP10</h2>
        <p className="text-sm text-secondary mb-3">今月の欠勤日数順</p>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA] w-10">#</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">稼働先</th>
                <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">欠勤日数</th>
                <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">直近の理由</th>
              </tr>
            </thead>
            <tbody>
              {absenceTop.length === 0 ? (
                <tr><td colSpan={5}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
              ) : absenceTop.map((item, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  <td className="px-4 py-2.5 text-base text-secondary">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{item.name}</td>
                  <td className="px-4 py-2.5 text-base">{item.client}</td>
                  <td className="px-4 py-2.5 text-base text-right tabular-nums font-bold">{item.absenceDays}日</td>
                  <td className="px-4 py-2.5 text-base">{item.recentReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
