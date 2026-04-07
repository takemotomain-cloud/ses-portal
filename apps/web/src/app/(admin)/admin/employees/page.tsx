/**
 * 管理側 社員一覧（API連携版）
 *
 * 行クリックで社員詳細ページ（/admin/employees/:id）に遷移。
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface Employee {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  status: string;
  employmentType: string;
  contractType: string;
  hireDate: string;
  departmentName: string | null;
  positionName: string | null;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: '在籍', cls: 'badge-ok' },
  leave: { label: '休職中', cls: 'badge-warn' },
  resigned: { label: '退職', cls: 'badge-danger' },
};

const empTypeLabel: Record<string, string> = {
  regular: '正社員',
  contract: '契約社員',
  parttime: 'パート',
};

const contractLabel: Record<string, string> = {
  indefinite: '無期',
  fixed: '有期',
  fixed_term: '有期',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function AdminEmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast, ToastUI } = useToast();

  useEffect(() => {
    apiClient<{ data: Employee[] }>('/employees')
      .then((res) => setEmployees(res.data || []))
      .catch((err) => {
        console.error('Failed to fetch employees:', err);
        setError(err?.message || 'データの取得に失敗しました');
        setEmployees([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const name = `${e.lastName} ${e.firstName}`;
      if (search && !name.includes(search) && !e.employeeCode.includes(search)) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [employees, search, statusFilter]);

  const kpis = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    leave: employees.filter(e => e.status === 'leave').length,
  }), [employees]);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">社員一覧</h1>
        <button onClick={() => router.push('/admin/employees/new')} className="btn-primary text-sm py-2">新規社員登録</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-xs text-secondary">全社員数</div>
          <div className="text-3xl font-medium">{kpis.total}<span className="text-base font-normal text-secondary ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">在籍中</div>
          <div className="text-3xl font-medium text-status-green-text">{kpis.active}<span className="text-base font-normal ml-1">名</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-secondary">休職中</div>
          <div className="text-3xl font-medium text-status-amber-text">{kpis.leave}<span className="text-base font-normal ml-1">名</span></div>
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="氏名・社員番号で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card min-w-[180px] focus:border-primary"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded-md px-3 py-[7px] text-sm outline-none bg-card appearance-none"
        >
          <option value="">ステータス: すべて</option>
          <option value="active">在籍</option>
          <option value="leave">休職中</option>
          <option value="resigned">退職</option>
        </select>
        <span className="text-sm text-secondary self-center">{filtered.length}名</span>
      </div>

      {/* テーブル */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              {['社員番号', '氏名', '部署', '雇用形態', '雇用区分', 'ステータス', '入社日'].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : error ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-red-500">{error}</div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map((emp) => {
              const st = statusBadge[emp.status] || { label: emp.status, cls: 'badge-wait' };
              const ct = contractLabel[emp.contractType] || emp.contractType;
              return (
                <tr
                  key={emp.id}
                  onClick={() => router.push(`/admin/employees/${emp.id}`)}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 text-base text-secondary">{emp.employeeCode}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{emp.lastName} {emp.firstName}</td>
                  <td className="px-4 py-2.5 text-base">{emp.departmentName || '—'}</td>
                  <td className="px-4 py-2.5 text-base">{empTypeLabel[emp.employmentType] || emp.employmentType}</td>
                  <td className="px-4 py-2.5 text-base">
                    <span className={`badge ${ct === '無期' ? 'badge-ok' : 'badge-info'}`}>{ct}</span>
                  </td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5 text-base text-secondary">{fmtDate(emp.hireDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ToastUI />
    </div>
  );
}
