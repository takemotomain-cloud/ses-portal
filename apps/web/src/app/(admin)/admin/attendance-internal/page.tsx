/**
 * 管理側 社内勤怠管理
 *
 * アサインがない社員（待機中 employee + manager + member）の勤怠一覧。
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
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const empData = await apiClient<InternalEmployee[]>(
        `/attendance/admin/internal/${targetYear}/${targetMonth}`,
      );
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch {
      toast('データの取得に失敗しました');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [targetYear, targetMonth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmedCount = employees.filter(e => e.isConfirmed).length;
  const allConfirmed = employees.length > 0 && confirmedCount === employees.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3">
        <h1 className="text-2xl font-medium">社内勤怠管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const idx = monthOptions.findIndex(o => o.value === targetKey);
              if (idx < monthOptions.length - 1) setTargetKey(monthOptions[idx + 1].value);
            }}
            disabled={monthOptions.findIndex(o => o.value === targetKey) >= monthOptions.length - 1}
            className="btn-outline py-1 px-3 text-sm disabled:opacity-30"
          >&lt;</button>
          <span className="text-lg font-medium min-w-[120px] text-center">{targetYear}年{targetMonth}月</span>
          <button
            onClick={() => {
              const idx = monthOptions.findIndex(o => o.value === targetKey);
              if (idx > 0) setTargetKey(monthOptions[idx - 1].value);
            }}
            disabled={monthOptions.findIndex(o => o.value === targetKey) <= 0}
            className="btn-outline py-1 px-3 text-sm disabled:opacity-30"
          >&gt;</button>
        </div>
      </div>

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
          <div className="text-xs text-secondary">勤怠確定済</div>
          <div className="text-3xl font-medium">
            {confirmedCount}
            <span className="text-base font-normal text-secondary ml-1">
              / {employees.length}名
            </span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">確定状態</div>
          <div className="mt-1">
            {allConfirmed ? (
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

      <ToastUI />
    </div>
  );
}
