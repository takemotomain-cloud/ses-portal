/**
 * 管理側 削除済み社員一覧（P1 復活フロー）
 *
 * deletedAt がセットされた社員を表示し、「復活」ボタンで論理削除を解除する。
 * 復活時はメール / 社員番号がアクティブな他社員と衝突していないかチェック済み。
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface DeletedEmployee {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  status: string;
  employmentType: string;
  hireDate: string;
  resignDate: string | null;
  deletedAt: string;
  departmentName: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function DeletedEmployeesPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [list, setList] = useState<DeletedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<{ data: DeletedEmployee[]; total: number }>('/employees/deleted');
      setList(res.data || []);
    } catch (err: any) {
      setError(err?.message || '削除済み社員の取得に失敗しました');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleRestore = async (id: string) => {
    setSubmitting(true);
    try {
      await apiClient(`/employees/${id}/restore`, { method: 'POST' });
      toast('社員を復活しました');
      setConfirmId(null);
      await fetchList();
    } catch (err: any) {
      toast(err?.message || '復活に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const target = confirmId ? list.find(e => e.id === confirmId) : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">削除済み社員</h1>
        <button onClick={() => router.push('/admin/employees')} className="btn-outline text-sm py-2">
          社員一覧へ戻る
        </button>
      </div>

      <div className="card p-4 mb-4 bg-[#FEFBF0] border-l-4 border-status-amber-text">
        <div className="text-sm text-status-amber-text font-medium mb-1">⚠ 論理削除済み社員の復活</div>
        <div className="text-xs text-secondary">
          削除済み社員は一覧・検索から非表示になっていますが、勤怠・給与・アサインなどの過去データは保持されています。
          「復活」ボタンで削除状態を解除し、通常の社員一覧に戻すことができます。
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              {['社員番号', '氏名', '部署', '雇用形態', '入社日', '退職日', '削除日', ''].map(h => (
                <th key={h} className="text-left text-xs text-secondary font-normal px-4 py-2.5 bg-[#FAFAFA]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">読み込み中...</div></td></tr>
            ) : error ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-red-500">{error}</div></td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8}><div className="px-4 py-8 text-center text-sm text-secondary">削除済み社員はいません</div></td></tr>
            ) : list.map(emp => (
              <tr key={emp.id} className="border-b border-border/20 text-base">
                <td className="px-4 py-2.5 text-secondary">{emp.employeeCode}</td>
                <td className="px-4 py-2.5 font-medium">{emp.lastName} {emp.firstName}</td>
                <td className="px-4 py-2.5">{emp.departmentName || '—'}</td>
                <td className="px-4 py-2.5">{emp.employmentType}</td>
                <td className="px-4 py-2.5 text-secondary">{fmtDate(emp.hireDate)}</td>
                <td className="px-4 py-2.5 text-secondary">{fmtDate(emp.resignDate)}</td>
                <td className="px-4 py-2.5 text-secondary">{fmtDate(emp.deletedAt)}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => setConfirmId(emp.id)}
                    className="text-xs px-3 py-1 rounded border border-status-green-text text-status-green-text hover:bg-status-green-bg transition-colors"
                  >
                    復活
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-md font-semibold mb-3">社員を復活します</h3>
            <p className="text-sm text-secondary mb-5">
              <span className="font-medium text-primary">{target.lastName} {target.firstName}</span>（{target.employeeCode}）を復活します。
              復活すると通常の社員一覧に戻り、勤怠やアサインを再開できるようになります。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="btn-outline text-sm py-2"
                disabled={submitting}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleRestore(target.id)}
                className="btn-primary text-sm py-2"
                disabled={submitting}
              >
                {submitting ? '処理中...' : '復活する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
