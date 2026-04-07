/**
 * 管理側 新規アサイン登録ページ
 *
 * HTMLプロトタイプ page-form-assign を完全再現。
 * セクション: 社員情報 → 契約情報 → 勤務情報
 * API未接続 — フォームUIのみ。
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- フォーム状態型 ---------- */

interface AssignForm {
  employeeId: string;
  clientId: string;
  projectName: string;
  contractPrice: string;
  rewardRate: string;
  settlementLower: string;
  settlementUpper: string;
  contractStartDate: string;
  contractEndDate: string;
  workStartTime: string;
  attendanceFormat: string;
  workLocation: string;
  area: string;
  supplyChain: string;
  remarks: string;
}

const initialForm: AssignForm = {
  employeeId: '',
  clientId: '',
  projectName: '',
  contractPrice: '',
  rewardRate: '',
  settlementLower: '',
  settlementUpper: '',
  contractStartDate: '',
  contractEndDate: '',
  workStartTime: '9:00',
  attendanceFormat: 'none',
  workLocation: '',
  area: '',
  supplyChain: 'エンド → 自社',
  remarks: '',
};

/* ---------- 共通スタイル ---------- */

const inputCls =
  'w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30';
const selectCls =
  'w-full border border-border rounded-md px-3 py-2 text-sm outline-none appearance-none focus:ring-1 focus:ring-primary/30';
const labelCls = 'block text-2xs text-secondary mb-1';
const requiredMark = <span className="text-red-600">*</span>;

/* ---------- メインコンポーネント ---------- */

export default function NewAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, ToastUI } = useToast();
  const [form, setForm] = useState<AssignForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; label: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  // URLパラメータから引き継ぎ値を取得
  const prefillClientId = searchParams.get('clientId') || '';
  const prefillEmployeeName = searchParams.get('employeeName') || '';
  const prefillEmployeeCode = searchParams.get('employeeCode') || '';
  const prefillProjectName = searchParams.get('projectName') || '';

  useEffect(() => {
    // 社員一覧とクライアント一覧を並行取得
    Promise.all([
      apiClient<{ data: any[] }>('/employees?limit=200').catch(() => ({ data: [] })),
      apiClient<{ data: any[] }>('/clients?limit=200').catch(() => ({ data: [] })),
    ]).then(([empRes, clientRes]) => {
      const empList = empRes.data.map((e: any) => ({
        id: e.id,
        label: `${e.lastName} ${e.firstName}`,
        code: e.employeeCode || '',
      }));
      setEmployees(empList);

      const clientList = clientRes.data.map((c: any) => ({ id: c.id, name: c.name }));
      setClients(clientList);

      // URLパラメータからの自動選択
      const updates: Partial<AssignForm> = {};

      // 社員を名前 or 社員コードでマッチング
      if (prefillEmployeeName || prefillEmployeeCode) {
        const matched = empList.find((e: any) =>
          (prefillEmployeeCode && e.code === prefillEmployeeCode) ||
          (prefillEmployeeName && e.label === prefillEmployeeName)
        );
        if (matched) updates.employeeId = matched.id;
      }

      // クライアントをIDで直接セット
      if (prefillClientId) {
        const matched = clientList.find((c: any) => c.id === prefillClientId);
        if (matched) updates.clientId = matched.id;
      }

      // 案件名
      if (prefillProjectName) {
        updates.projectName = prefillProjectName;
      }

      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }));
      }
    });
  }, [prefillClientId, prefillEmployeeName, prefillEmployeeCode, prefillProjectName]);

  function update(field: keyof AssignForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.clientId || !form.projectName || !form.contractPrice || !form.contractStartDate) {
      toast('必須項目を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.employeeId,
          clientId: form.clientId,
          projectName: form.projectName,
          contractPrice: parseInt(form.contractPrice.replace(/,/g, ''), 10) || 0,
          settlementLower: parseInt(form.settlementLower, 10) || 140,
          settlementUpper: parseInt(form.settlementUpper, 10) || 180,
          workLocation: form.workLocation || undefined,
          area: form.area || undefined,
          defaultStartTime: form.workStartTime || undefined,
          attendanceFormat: form.attendanceFormat,
          startDate: form.contractStartDate,
          endDate: form.contractEndDate || undefined,
        }),
      });
      toast('アサインを登録しました');
      router.push('/admin/assignments');
    } catch (err: any) {
      toast(err?.message || 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">新規アサイン登録</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/assignments')}
            className="btn-outline text-sm py-2"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm py-2 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 680 }}>
        {/* ── 社員情報 ── */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">社員情報</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>社員 {requiredMark}</label>
              <select
                className={selectCls}
                value={form.employeeId}
                onChange={(e) => update('employeeId', e.target.value)}
              >
                <option value="">選択してください</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>クライアント {requiredMark}</label>
              <select
                className={selectCls}
                value={form.clientId}
                onChange={(e) => update('clientId', e.target.value)}
              >
                <option value="">選択してください</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>{cl.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-2">
            <label className={labelCls}>案件名 {requiredMark}</label>
            <input
              type="text"
              className={inputCls}
              placeholder="例: 基幹システムリプレース"
              value={form.projectName}
              onChange={(e) => update('projectName', e.target.value)}
            />
          </div>
        </div>

        {/* ── 契約情報 ── */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">契約情報</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>契約単価（月額） {requiredMark}</label>
              <input
                type="text"
                className={inputCls}
                placeholder="650,000"
                value={form.contractPrice}
                onChange={(e) => update('contractPrice', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>還元率</label>
              <input
                type="text"
                className={inputCls}
                placeholder="72%"
                value={form.rewardRate}
                onChange={(e) => update('rewardRate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>精算幅（下限）</label>
              <input
                type="text"
                className={inputCls}
                placeholder="140"
                value={form.settlementLower}
                onChange={(e) => update('settlementLower', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>精算幅（上限）</label>
              <input
                type="text"
                className={inputCls}
                placeholder="180"
                value={form.settlementUpper}
                onChange={(e) => update('settlementUpper', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>契約開始日 {requiredMark}</label>
              <input
                type="date"
                className={inputCls}
                value={form.contractStartDate}
                onChange={(e) => update('contractStartDate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>契約終了日 {requiredMark}</label>
              <input
                type="date"
                className={inputCls}
                value={form.contractEndDate}
                onChange={(e) => update('contractEndDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>稼働開始時刻</label>
              <select
                className={selectCls}
                value={form.workStartTime}
                onChange={(e) => update('workStartTime', e.target.value)}
              >
                <option value="8:00">8時00分</option>
                <option value="8:30">8時30分</option>
                <option value="9:00">9時00分</option>
                <option value="9:30">9時30分</option>
                <option value="10:00">10時00分</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>請求時の勤怠表添付</label>
              <select
                className={selectCls}
                value={form.attendanceFormat}
                onChange={(e) => update('attendanceFormat', e.target.value)}
              >
                <option value="none">不要</option>
                <option value="company">自社フォーマット</option>
                <option value="client_original">現場データそのまま</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── 勤務情報 ── */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">勤務情報</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>勤務地</label>
              <input
                type="text"
                className={inputCls}
                placeholder="大阪市中央区（常駐）"
                value={form.workLocation}
                onChange={(e) => update('workLocation', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>エリア</label>
              <select
                className={selectCls}
                value={form.area}
                onChange={(e) => update('area', e.target.value)}
              >
                <option value="">選択してください</option>
                <option value="tokyo">東京</option>
                <option value="osaka">大阪</option>
                <option value="nagoya">名古屋</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <div>
              <label className={labelCls}>商流</label>
              <select
                className={selectCls}
                value={form.supplyChain}
                onChange={(e) => update('supplyChain', e.target.value)}
              >
                <option>エンド → 自社</option>
                <option>エンド → 1社 → 自社</option>
                <option>エンド → 2社 → 自社</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>備考</label>
            <textarea
              className={`${inputCls} resize-y`}
              style={{ height: 60 }}
              placeholder="特記事項があれば入力"
              value={form.remarks}
              onChange={(e) => update('remarks', e.target.value)}
            />
          </div>
        </div>
      </form>

      <ToastUI />
    </div>
  );
}
