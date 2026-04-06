/**
 * 管理側 本日のアラート
 *
 * HTMLプロトタイプ仕様を再現。
 * 出勤打刻未確認一覧 + 本日の欠勤 + 有給取得一覧。
 * テーブルレイアウト使用。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface MissedClockIn {
  name: string;
  client: string;
  expectedTime: string;
  elapsed: string;
  phone: string;
  status: 'unconfirmed' | 'confirmed';
}

interface Absence {
  name: string;
  client: string;
  reason: string;
  filedDate: string;
}

interface PaidLeave {
  name: string;
  client: string;
  applicationDate: string;
  approver: string;
}

const today = new Date();
const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

export default function AlertsTodayPage() {
  const [missedClockIn, setMissedClockIn] = useState<MissedClockIn[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [paidLeaves, setPaidLeaves] = useState<PaidLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());
  const { toast, ToastUI } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch missed clock-in data
      try {
        const missedRes = await apiClient<Array<Record<string, unknown>>>('/attendance/missed');
        const mapped: MissedClockIn[] = (missedRes || []).map((r) => ({
          name: String(r.employeeName ?? r.name ?? ''),
          client: String(r.client ?? r.projectName ?? ''),
          expectedTime: String(r.expectedTime ?? r.startTime ?? ''),
          elapsed: String(r.elapsed ?? r.elapsedTime ?? ''),
          phone: String(r.phone ?? r.phoneNumber ?? ''),
          status: (r.status === 'confirmed' ? 'confirmed' : 'unconfirmed') as MissedClockIn['status'],
        }));
        setMissedClockIn(mapped);
      } catch {
        setMissedClockIn([]);
      }

      // Fetch leave data (absences + paid leaves)
      try {
        const leaveRes = await apiClient<Array<{
          id: number;
          leaveType: string;
          startDate: string;
          endDate: string;
          days: number;
          reason: string;
          status: string;
          createdAt: string;
          employee: { lastName: string; firstName: string; employeeCode: string };
        }>>('/leave/pending');

        const leaves = leaveRes || [];

        const mappedAbsences: Absence[] = leaves
          .filter((l) => l.leaveType !== '有給休暇')
          .map((l) => ({
            name: `${l.employee.lastName} ${l.employee.firstName}`,
            client: '',
            reason: l.reason || l.leaveType,
            filedDate: l.createdAt ? new Date(l.createdAt).toLocaleDateString('ja-JP') : '',
          }));
        setAbsences(mappedAbsences);

        const mappedPaidLeaves: PaidLeave[] = leaves
          .filter((l) => l.leaveType === '有給休暇')
          .map((l) => ({
            name: `${l.employee.lastName} ${l.employee.firstName}`,
            client: '',
            applicationDate: l.createdAt ? new Date(l.createdAt).toLocaleDateString('ja-JP') : '',
            approver: '',
          }));
        setPaidLeaves(mappedPaidLeaves);
      } catch {
        setAbsences([]);
        setPaidLeaves([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function confirmMissed(idx: number) {
    setConfirmedIds(prev => new Set([...prev, idx]));
    toast('確認済にしました');
  }

  const unconfirmedCount = missedClockIn.length - confirmedIds.size;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">本日のアラート</h1>
        <span className="text-sm text-secondary">{dateStr}</span>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-2 text-sm text-secondary">読み込み中...</span>
        </div>
      )}

      {!loading && <>
      {/* Section 1: 出勤打刻未確認 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-md font-medium text-status-red-text">出勤打刻未確認</h2>
          <span className="text-sm text-secondary">{unconfirmedCount}件</span>
        </div>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border">
                {['氏名', '稼働先', '稼働開始時刻', '経過時間', '電話番号', '状態', 'アクション'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {missedClockIn.length === 0 ? (
                <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
              ) : missedClockIn.map((item, idx) => {
                const isConfirmed = confirmedIds.has(idx);
                return (
                  <tr key={idx} className={`border-b border-border/20 transition-opacity ${isConfirmed ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5 text-base font-medium">{item.name}</td>
                    <td className="px-4 py-2.5 text-base">{item.client}</td>
                    <td className="px-4 py-2.5 text-base">{item.expectedTime}</td>
                    <td className="px-4 py-2.5 text-base">{item.elapsed}</td>
                    <td className="px-4 py-2.5 text-base">{item.phone}</td>
                    <td className="px-4 py-2.5">
                      {isConfirmed ? (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-status-green-bg text-status-green-text">確認済</span>
                      ) : (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-status-red-bg text-status-red-text">未確認</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {!isConfirmed && (
                        <button onClick={() => confirmMissed(idx)} className="btn-outline text-xs py-1 px-2">確認済にする</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: 本日の欠勤 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-md font-medium">本日の欠勤</h2>
          <span className="text-sm text-secondary">{absences.length}名</span>
        </div>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                {['氏名', '稼働先', '理由', '届出日'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {absences.length === 0 ? (
                <tr><td colSpan={4}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
              ) : absences.map((item, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  <td className="px-4 py-2.5 text-base font-medium">{item.name}</td>
                  <td className="px-4 py-2.5 text-base">{item.client}</td>
                  <td className="px-4 py-2.5 text-base">{item.reason}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{item.filedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: 本日の有給取得 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-md font-medium">本日の有給取得</h2>
          <span className="text-sm text-secondary">{paidLeaves.length}名</span>
        </div>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                {['氏名', '稼働先', '申請日', '承認者'].map(h => (
                  <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paidLeaves.length === 0 ? (
                <tr><td colSpan={4}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
              ) : paidLeaves.map((item, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  <td className="px-4 py-2.5 text-base font-medium">{item.name}</td>
                  <td className="px-4 py-2.5 text-base">{item.client}</td>
                  <td className="px-4 py-2.5 text-base text-secondary">{item.applicationDate}</td>
                  <td className="px-4 py-2.5 text-base">{item.approver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </>}

      <ToastUI />
    </div>
  );
}
