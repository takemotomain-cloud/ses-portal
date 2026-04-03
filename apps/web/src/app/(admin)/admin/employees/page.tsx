/**
 * 管理側 社員一覧
 *
 * UIモックのpage-employeesを再現。
 * KPI3枚 + フィルタ + テーブル + 行クリックで詳細パネル。
 *
 * Phase 1: デモデータ。API連携後にGET /api/employeesを呼ぶ。
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

type Employee = { id: string; code: string; name: string; dept: string; type: string; contract: string; status: string; hire: string };

const demoEmployees: Employee[] = [];

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: '在籍', cls: 'badge-ok' },
  leave: { label: '休職中', cls: 'badge-warn' },
  resigned: { label: '退職', cls: 'badge-danger' },
};

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(demoEmployees);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    apiClient('/employees')
      .then((data) => setEmployees(data as Employee[]))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (search && !e.name.includes(search) && !e.code.includes(search)) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      return true;
    });
  }, [search, statusFilter]);

  const selected = selectedId ? employees.find(e => e.id === selectedId) : null;

  const kpis = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    leave: employees.filter(e => e.status === 'leave').length,
  }), [employees]);
  const { toast, ToastUI } = useToast();

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">社員一覧</h1>
        <button onClick={() => toast('この機能は現在準備中です')} className="btn-primary text-sm py-2">新規社員登録</button>
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
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="px-4 py-8 text-center text-sm text-secondary">データはありません</div></td></tr>
            ) : filtered.map((emp) => {
              const st = statusBadge[emp.status];
              return (
                <tr
                  key={emp.id}
                  onClick={() => setSelectedId(emp.id)}
                  className="border-b border-border/20 hover:bg-[#FAFAF8] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 text-base text-secondary">{emp.code}</td>
                  <td className="px-4 py-2.5 text-base font-medium">{emp.name}</td>
                  <td className="px-4 py-2.5 text-base">{emp.dept}</td>
                  <td className="px-4 py-2.5 text-base">{emp.type}</td>
                  <td className="px-4 py-2.5 text-base">
                    <span className={`badge ${emp.contract === '無期' ? 'badge-ok' : 'badge-info'}`}>
                      {emp.contract}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5 text-base text-secondary">{emp.hire}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 詳細パネル */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/8 z-[99]" onClick={() => setSelectedId(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-[100] overflow-y-auto">
            <div className="flex justify-between items-start p-5 border-b border-border/30">
              <div>
                <h2 className="text-xl font-medium">{selected.name}</h2>
                <div className="text-sm text-secondary mt-0.5">{selected.code} · {selected.dept}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-xl text-secondary hover:text-primary px-2 py-1 rounded hover:bg-page">✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-2xs text-secondary uppercase tracking-widest mb-2">基本情報</div>
                {[
                  ['雇用形態', selected.type],
                  ['雇用区分', selected.contract],
                  ['入社日', selected.hire],
                  ['ステータス', statusBadge[selected.status].label],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5 border-b border-border/20 text-base">
                    <span className="text-secondary">{l}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline flex-1 text-sm py-2">編集</button>
                <button onClick={() => toast('この機能は現在準備中です')} className="btn-outline flex-1 text-sm py-2">勤怠履歴</button>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastUI />
    </div>
  );
}
