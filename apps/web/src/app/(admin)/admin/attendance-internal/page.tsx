/**
 * 管理側 社内勤怠管理
 *
 * アサインがない社員（待機中 employee + manager + member）の勤怠一覧。
 * 月次勤怠の一括確定ボタンを配置（SES勤怠 + 社内勤怠の全社員を対象に確定）。
 * admin（役員）は勤怠免除のため表示対象外。
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';

/* ---- 型定義 ---- */

interface InternalEmployee {
  employeeId: string;
  employeeCode: string;
  name: string;
  departmentName: string;
  role: string;
  workDays: number;
  totalOvertimeHours: number;
  hasMissedClock: boolean;
  hasAttendance: boolean;
  isConfirmed: boolean;
}

interface ClosureData {
  yearMonth: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  hasPostCloseChanges: boolean;
  readiness: {
    totalEmployees: number;
    confirmedCount: number;
    exemptCount: number;
    unconfirmedEmployees: {
      employeeId: string;
      name: string;
      employeeCode: string;
      departmentName: string;
    }[];
  };
}

/** 対象月の選択肢を生成（当月から過去12ヶ月） */
function buildMonthOptions(): { value: string; label: string; year: number; month: number }[] {
  const now = new Date();
  const options: { value: string; label: string; year: number; month: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    options.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: `${y}年${m}月`,
      year: y,
      month: m,
    });
  }
  return options;
}

export default function AttendanceInternalPageWrapper() {
  return (
    <AuthGuard requiredRoles={['admin', 'manager']}>
      <AttendanceInternalPage />
    </AuthGuard>
  );
}

function AttendanceInternalPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();

  const monthOptions = buildMonthOptions();
  const [targetKey, setTargetKey] = useState<string>(monthOptions[0].value);
  const current = monthOptions.find(o => o.value === targetKey) || monthOptions[0];
  const targetYear = current.year;
  const targetMonth = current.month;

  const [employees, setEmployees] = useState<InternalEmployee[]>([]);
  const [closure, setClosure] = useState<ClosureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [closing, setClosing] = useState(false);

  /** データ取得 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empData, closureData] = await Promise.all([
        apiClient<InternalEmployee[]>(`/attendance/admin/internal/${targetYear}/${targetMonth}`),
        apiClient<ClosureData>(`/attendance/admin/closure/${targetYear}/${targetMonth}`),
      ]);
      setEmployees(Array.isArray(empData) ? empData : []);
      setClosure(closureData);
    } catch {
      toast('データの取得に失敗しました');
      setEmployees([]);
      setClosure(null);
    } finally {
      setLoading(false);
    }
  }, [targetYear, targetMonth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** 勤怠一括確定 */
  const handleClose = async () => {
    setClosing(true);
    try {
      await apiClient(`/attendance/admin/closure/${targetYear}/${targetMonth}/close`, {
        method: 'POST',
      });
      toast('勤怠を確定しました');
      setShowConfirmModal(false);
      await fetchData();
    } catch (err: any) {
      toast(err?.message || '勤怠の確定に失敗しました');
    } finally {
      setClosing(false);
    }
  };

  /** 勤怠確定解除 */
  const handleReopen = async () => {
    if (!confirm('勤怠確定を解除しますか？給与計算が実行できなくなります。')) return;
    try {
      await apiClient(`/attendance/admin/closure/${targetYear}/${targetMonth}/reopen`, {
        method: 'POST',
      });
      toast('勤怠確定を解除しました');
      await fetchData();
    } catch (err: any) {
      toast(err?.message || '確定解除に失敗しました');
    }
  };

  const isClosed = closure?.status === 'closed';
  const unconfirmedCount = closure?.readiness.unconfirmedEmployees.length ?? 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">社内勤怠管理</h1>
        <div className="flex gap-2 items-center">
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="border border-border/30 rounded-md px-3 py-1.5 text-sm bg-white outline-none focus:border-primary/40"
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {isClosed ? (
            <button onClick={handleReopen} className="btn-outline text-sm py-1.5">
              確定解除
            </button>
          ) : (
            <button
              onClick={() => {
                if (unconfirmedCount > 0) {
                  setShowConfirmModal(true);
                } else {
                  if (confirm(`${targetYear}年${targetMonth}月の勤怠を確定しますか？`)) {
                    handleClose();
                  }
                }
              }}
              className="btn-primary text-sm py-1.5"
            >
              勤怠一括確定
            </button>
          )}
        </div>
      </div>

      {/* 確定ステータスバナー */}
      {isClosed && (
        <div className="bg-status-green-bg border border-status-green-text/20 text-status-green-text rounded-md px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <span className="text-lg">&#10003;</span>
          <span>
            {targetYear}年{targetMonth}月の勤怠は確定済みです
            {closure?.closedAt && (
              <span className="text-xs ml-2 opacity-70">
                ({new Date(closure.closedAt).toLocaleString('ja-JP')} 確定)
              </span>
            )}
          </span>
        </div>
      )}
      {closure?.hasPostCloseChanges && (
        <div className="bg-[#FFFBEB] border border-[#F0C674] text-[#92600E] rounded-md px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <span className="text-lg">&#9888;</span>
          <span>確定後に修正申請が承認されています。給与の再計算を推奨します。</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">対象月</div>
          <div className="text-xl font-medium">{targetYear}年{targetMonth}月</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">社内勤怠対象</div>
          <div className="text-3xl font-medium">{employees.length}<span className="text-base font-normal text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">全社 勤怠入力済</div>
          <div className="text-3xl font-medium">
            {closure ? closure.readiness.confirmedCount : '--'}
            <span className="text-base font-normal text-secondary ml-1">
              / {closure ? (closure.readiness.totalEmployees - closure.readiness.exemptCount) : '--'}名
            </span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">確定状態</div>
          <div className="mt-1">
            {isClosed ? (
              <span className="badge badge-ok">確定済</span>
            ) : (
              <span className="badge badge-wait">未確定</span>
            )}
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">社員番号</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">氏名</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">部署</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">ロール</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">出勤日数</th>
              <th className="text-right text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">残業時間</th>
              <th className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">本人勤怠確定</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">対象の社員がいません（全員アサインあり or admin のみ）</div></td></tr>
            ) : employees.map(e => (
              <tr
                key={e.employeeId}
                onClick={() => router.push(`/admin/attendance-internal/${e.employeeId}?year=${targetYear}&month=${targetMonth}`)}
                className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 text-sm text-secondary">{e.employeeCode}</td>
                <td className="px-4 py-2.5 text-base font-medium">{e.name}</td>
                <td className="px-4 py-2.5 text-sm">{e.departmentName}</td>
                <td className="px-4 py-2.5 text-sm">{e.role}</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{e.workDays}日</td>
                <td className="px-4 py-2.5 text-base text-right tabular-nums">{e.totalOvertimeHours}h</td>
                <td className="px-4 py-2.5">
                  {e.isConfirmed ? (
                    <span className="badge badge-ok">確定</span>
                  ) : (
                    <span className="badge badge-wait">未確定</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 未確定社員モーダル */}
      {showConfirmModal && closure && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[99]" onClick={() => setShowConfirmModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-lg shadow-xl z-[100] w-full max-w-[520px] max-h-[80vh] overflow-y-auto">
            <div className="p-5 border-b border-border/30">
              <h2 className="text-lg font-medium">勤怠未入力の社員がいます</h2>
              <p className="text-sm text-secondary mt-1">
                以下の{unconfirmedCount}名の勤怠が未入力です。このまま確定することはできません。
              </p>
            </div>
            <div className="p-5">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {closure.readiness.unconfirmedEmployees.map(e => (
                  <div key={e.employeeId} className="flex justify-between items-center py-2 px-3 bg-[#F7F7F5] rounded-md text-sm">
                    <div>
                      <span className="text-secondary mr-2">{e.employeeCode}</span>
                      <span className="font-medium">{e.name}</span>
                    </div>
                    <span className="text-xs text-secondary">{e.departmentName}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-border/30 flex justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="btn-outline text-sm py-2 px-4"
              >
                閉じる
              </button>
            </div>
          </div>
        </>
      )}

      <ToastUI />
    </div>
  );
}
