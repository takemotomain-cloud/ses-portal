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

interface ProjectOption {
  id: string;
  name: string;
  contractPrice: number | null;
  rewardRate: string | null;
  settlementLower: number | null;
  settlementUpper: number | null;
  overtimeRate: number | null;
  deductionRate: number | null;
  startDate: string | null;
  endDate: string | null;
  workLocation: string | null;
  area: string | null;
  defaultStartTime: string | null;
  attendanceFormat: string;
  clientAttendanceRequired: boolean;
  supplyChain: string | null;
}

interface AssignForm {
  employeeId: string;
  clientId: string;
  projectId: string; // '' = 未選択, 'new' = 新規作成
  projectName: string;
  contractPrice: string;
  rewardRate: string;
  settlementLower: string;
  settlementUpper: string;
  overtimeRate: string;
  deductionRate: string;
  contractStartDate: string;
  contractEndDate: string;
  workStartTime: string;
  attendanceFormat: string;
  clientAttendanceRequired: string;
  workLocation: string;
  area: string;
  supplyChain: string;
  remarks: string;
}

const initialForm: AssignForm = {
  employeeId: '',
  clientId: '',
  projectId: '',
  projectName: '',
  contractPrice: '',
  rewardRate: '',
  settlementLower: '',
  settlementUpper: '',
  overtimeRate: '',
  deductionRate: '',
  contractStartDate: '',
  contractEndDate: '',
  workStartTime: '9:00',
  attendanceFormat: 'none',
  clientAttendanceRequired: 'true',
  workLocation: '',
  area: '',
  supplyChain: '一次請け',
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
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // URLパラメータから引き継ぎ値を取得
  const prefillClientId = searchParams.get('clientId') || '';
  const prefillEmployeeName = searchParams.get('employeeName') || '';
  const prefillEmployeeCode = searchParams.get('employeeCode') || '';
  const prefillProjectName = searchParams.get('projectName') || '';

  useEffect(() => {
    // 社員一覧とクライアント一覧を並行取得
    Promise.all([
      apiClient<{ data: any[] }>('/employees?limit=200&assignmentTarget=true').catch(() => ({ data: [] })),
      apiClient<{ data: any[] }>('/clients?limit=200').catch(() => ({ data: [] })),
    ]).then(async ([empRes, clientRes]) => {
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

      // 案件名 — 既存案件をマッチングし、なければ新規作成モード
      if (prefillProjectName) {
        updates.projectName = prefillProjectName;
        // クライアントが選択されている場合、案件一覧を取得してマッチング
        if (updates.clientId) {
          try {
            const projectList = await apiClient<ProjectOption[]>(`/projects?clientId=${updates.clientId}`);
            setProjects(projectList);
            const matchedProj = projectList.find(p => p.name === prefillProjectName);
            if (matchedProj) {
              updates.projectId = matchedProj.id;
              updates.workLocation = matchedProj.workLocation || '';
              updates.area = matchedProj.area || '';
              updates.workStartTime = matchedProj.defaultStartTime || '9:00';
              updates.attendanceFormat = matchedProj.attendanceFormat || 'none';
            } else {
              updates.projectId = 'new';
            }
          } catch {
            updates.projectId = 'new';
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }));
      }
    });
  }, [prefillClientId, prefillEmployeeName, prefillEmployeeCode, prefillProjectName]);

  // クライアント変更時に案件一覧を取得
  useEffect(() => {
    if (!form.clientId) { setProjects([]); return; }
    apiClient<ProjectOption[]>(`/projects?clientId=${form.clientId}`)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [form.clientId]);

  function update(field: keyof AssignForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleProjectChange(projectId: string) {
    setForm(prev => ({ ...prev, projectId }));
    if (projectId && projectId !== 'new') {
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
        setForm(prev => ({
          ...prev,
          projectId,
          projectName: proj.name,
          contractPrice: proj.contractPrice ? String(proj.contractPrice) : prev.contractPrice,
          rewardRate: proj.rewardRate || prev.rewardRate,
          settlementLower: proj.settlementLower ? String(proj.settlementLower) : prev.settlementLower,
          settlementUpper: proj.settlementUpper ? String(proj.settlementUpper) : prev.settlementUpper,
          overtimeRate: proj.overtimeRate != null ? String(proj.overtimeRate) : prev.overtimeRate,
          deductionRate: proj.deductionRate != null ? String(proj.deductionRate) : prev.deductionRate,
          contractStartDate: proj.startDate ? proj.startDate.slice(0, 10) : prev.contractStartDate,
          contractEndDate: proj.endDate ? proj.endDate.slice(0, 10) : prev.contractEndDate,
          workLocation: proj.workLocation || prev.workLocation,
          area: proj.area || prev.area,
          workStartTime: proj.defaultStartTime || '9:00',
          attendanceFormat: proj.attendanceFormat || 'none',
          clientAttendanceRequired: proj.clientAttendanceRequired === false ? 'false' : 'true',
          supplyChain: proj.supplyChain || prev.supplyChain,
        }));
      }
    } else if (projectId === 'new') {
      setForm(prev => ({ ...prev, projectId, projectName: '' }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.clientId || !form.projectId || !form.contractPrice || !form.contractStartDate || (form.projectId === 'new' && !form.projectName)) {
      toast('必須項目を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      let projectId = form.projectId;

      // 案件に保存する契約情報
      const projectPayload = {
        clientId: form.clientId,
        name: form.projectName,
        contractPrice: parseInt(form.contractPrice.replace(/,/g, ''), 10) || undefined,
        rewardRate: form.rewardRate || undefined,
        settlementLower: parseInt(form.settlementLower, 10) || undefined,
        settlementUpper: parseInt(form.settlementUpper, 10) || undefined,
        overtimeRate: form.overtimeRate ? parseInt(form.overtimeRate.replace(/,/g, ''), 10) : undefined,
        deductionRate: form.deductionRate ? parseInt(form.deductionRate.replace(/,/g, ''), 10) : undefined,
        startDate: form.contractStartDate || undefined,
        endDate: form.contractEndDate || undefined,
        workLocation: form.workLocation || undefined,
        area: form.area || undefined,
        defaultStartTime: form.workStartTime || undefined,
        attendanceFormat: form.attendanceFormat,
        clientAttendanceRequired: form.clientAttendanceRequired === 'true',
        supplyChain: form.supplyChain || undefined,
      };

      if (projectId === 'new' && form.projectName) {
        // 新規案件作成（契約情報含む）
        const newProject = await apiClient<{ id: string }>('/projects', {
          method: 'POST',
          body: JSON.stringify(projectPayload),
        });
        projectId = newProject.id;
      } else if (projectId && projectId !== 'new') {
        // 既存案件を契約情報で更新
        await apiClient(`/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify(projectPayload),
        });
      }

      await apiClient('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.employeeId,
          clientId: form.clientId,
          projectId: projectId && projectId !== 'new' ? projectId : undefined,
          projectName: form.projectName,
          contractPrice: parseInt(form.contractPrice.replace(/,/g, ''), 10) || 0,
          settlementLower: parseInt(form.settlementLower, 10) || 140,
          settlementUpper: parseInt(form.settlementUpper, 10) || 180,
          overtimeRate: form.overtimeRate ? parseInt(form.overtimeRate.replace(/,/g, ''), 10) : null,
          deductionRate: form.deductionRate ? parseInt(form.deductionRate.replace(/,/g, ''), 10) : null,
          workLocation: form.workLocation || undefined,
          area: form.area || undefined,
          defaultStartTime: form.workStartTime || undefined,
          attendanceFormat: form.attendanceFormat,
          clientAttendanceRequired: form.clientAttendanceRequired === 'true',
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
            <label className={labelCls}>案件 {requiredMark}</label>
            {form.clientId ? (
              <select
                className={selectCls}
                value={form.projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
              >
                <option value="">選択してください</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="new">＋ 新規案件を作成</option>
              </select>
            ) : (
              <div className="text-sm text-secondary py-2">先にクライアントを選択してください</div>
            )}
          </div>
          {form.projectId === 'new' && (
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
          )}
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
              <label className={labelCls}>超過1時間あたり単価（円）</label>
              <input
                type="text"
                className={inputCls}
                placeholder="未設定なら 契約単価÷上限 で自動計算"
                value={form.overtimeRate}
                onChange={(e) => update('overtimeRate', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>控除1時間あたり単価（円）</label>
              <input
                type="text"
                className={inputCls}
                placeholder="未設定なら 契約単価÷下限 で自動計算"
                value={form.deductionRate}
                onChange={(e) => update('deductionRate', e.target.value)}
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
              <label className={labelCls}>現場勤怠</label>
              <select
                className={selectCls}
                value={form.clientAttendanceRequired}
                onChange={(e) => update('clientAttendanceRequired', e.target.value)}
              >
                <option value="true">あり</option>
                <option value="false">なし</option>
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
              <label className={labelCls}>商流（自分たちが何次かを選択）</label>
              <select
                className={selectCls}
                value={form.supplyChain}
                onChange={(e) => update('supplyChain', e.target.value)}
              >
                <option>一次請け</option>
                <option>二次請け</option>
                <option>三次請け</option>
                <option>四次請け</option>
                <option>それ以下</option>
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
