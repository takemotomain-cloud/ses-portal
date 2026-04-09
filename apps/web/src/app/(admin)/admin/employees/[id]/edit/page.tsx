/**
 * 管理側 社員情報の編集ページ
 *
 * HTMLプロトタイプ page-emp-edit を完全再現。
 * セクション: 基本情報 → 連絡先 → 個人情報 → 緊急連絡先 → 給与・口座
 *           → 書類（Google Drive） → 保有資格
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

/* ---------- 取得データの型 ---------- */

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  birthDate: string | null;
  gender: string | null;
  email: string;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  education: string | null;
  schoolName: string | null;
  status: string;
  employmentType: string;
  contractType: string;
  hireDate: string;
  resignDate: string | null;
  baseSalary: number | null;
  rewardRate: number | null;
  contractHours: number | null;
  fixedOvertime: number | null;
  rateHealthInsurance: number | string | null;
  rateEmployeePension: number | string | null;
  rateEmploymentInsurance: number | string | null;
  rateIncomeTax: number | string | null;
  rateResidentTaxFixed: number | null;
  commuteStyle: string | null;
  leaveGrantMethod: string | null;
  transferredLeaveDays: number | string | null;
  transferredLeaveGrantedDate: string | null;
  hasBonus: boolean;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  station: string | null;
  qualifications: string[] | null;
  department: { id: string; name: string; code: string } | null;
  position: { id: string; name: string; rank: number } | null;
  emergencyContacts?: { id: string; name: string; relationship: string; phone: string }[];
  dependents?: { id: string; name: string; relationship: string; birthDate: string; annualIncome: number | null }[];
  /** E: ロール（user.role）。employeeId→user リレーションから取得 */
  user?: { id: string; role: string } | null;
}

/* ---------- ロール表示ラベル ---------- */

const roleLabel: Record<string, string> = {
  admin: '管理者 (admin)',
  manager: 'マネージャー (manager)',
  member: 'メンバー (member)',
  employee: '一般社員 (employee)',
};

/* ---------- フォーム状態の型 ---------- */

interface EditForm {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  employeeCode: string;
  hireDate: string;
  resignDate: string;
  department: string;
  employmentType: string;
  status: string;
  education: string;
  schoolName: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  gender: string;
  bloodType: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  baseSalary: string;
  rewardRate: string;
  contractHours: string;
  fixedOvertime: string;
  rateHealthInsurance: string;
  rateEmployeePension: string;
  rateEmploymentInsurance: string;
  rateIncomeTax: string;
  rateResidentTaxFixed: string;
  commuteStyle: string;
  leaveGrantMethod: string;
  transferredLeaveDays: string;
  transferredLeaveGrantedDate: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  station: string;
  driveUrl: string;
}

/* ---------- ラベルマップ ---------- */

const empTypeLabel: Record<string, string> = {
  regular: '正社員',
  contract: '契約社員',
  parttime: 'パート',
};

const empTypeReverse: Record<string, string> = {
  '正社員': 'regular',
  '契約社員': 'contract',
  'パート': 'parttime',
};

const statusLabel: Record<string, string> = {
  active: '在籍',
  waiting: '待機中',
  leave: '休職中',
  resigned: '退職',
};

const statusReverse: Record<string, string> = {
  '在籍': 'active',
  '待機中': 'waiting',
  '休職中': 'leave',
  '退職': 'resigned',
};

const genderLabel: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
};

const genderReverse: Record<string, string> = {
  '男性': 'male',
  '女性': 'female',
  'その他': 'other',
};

const educationLabel: Record<string, string> = {
  university: '大卒',
  grad_school: '大学院卒',
  vocational: '専門卒',
  high_school: '高卒',
  junior_college: '短大卒',
  technical_college: '高専卒',
};

const educationReverse: Record<string, string> = {
  '大卒': 'university',
  '大学院卒': 'grad_school',
  '専門卒': 'vocational',
  '高卒': 'high_school',
  '短大卒': 'junior_college',
  '高専卒': 'technical_college',
};

const accountTypeLabel: Record<string, string> = {
  ordinary: '普通',
  checking: '当座',
};

const accountTypeReverse: Record<string, string> = {
  '普通': 'ordinary',
  '当座': 'checking',
};

/** 部署名 → departmentId のマッピング（仮: 本来はAPIから取得） */
const deptNameMap: Record<string, string> = {
  'SES事業部': 'ses',
  '開発部': 'dev',
  '管理部': 'admin',
};

function fmtDateForDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '';
  const b = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return `${age}歳`;
}

/* ---------- 共通スタイル ---------- */

const labelCls = 'block text-[11px] text-secondary mb-[3px]';
const requiredMark = <span className="text-[#A32D2D]"> *</span>;
const inputCls =
  'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary/40 transition-colors';
const selectCls =
  'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none appearance-none bg-white focus:border-primary/40 transition-colors';
const readonlyCls =
  'w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none bg-[#F7F7F5]';

/* ---------- メインコンポーネント ---------- */

export default function EmployeeEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast, ToastUI } = useToast();
  const { user: currentUser } = useAuth();
  // E: ロール変更は admin のみ可能
  const canChangeRole = currentUser?.role === 'admin';
  // E: マイナンバー・銀行口座の閲覧は admin + manager のみ
  const canViewPii = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [form, setForm] = useState<EditForm>({
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    employeeCode: '',
    hireDate: '',
    resignDate: '',
    department: 'SES事業部',
    employmentType: '正社員',
    status: '在籍',
    education: '大卒',
    schoolName: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    gender: '男性',
    bloodType: 'A型',
    emergencyName: '',
    emergencyRelationship: '父',
    emergencyPhone: '',
    baseSalary: '',
    rewardRate: '',
    contractHours: '',
    fixedOvertime: '',
    rateHealthInsurance: '',
    rateEmployeePension: '',
    rateEmploymentInsurance: '',
    rateIncomeTax: '',
    rateResidentTaxFixed: '',
    commuteStyle: '',
    leaveGrantMethod: 'hire_date',
    transferredLeaveDays: '',
    transferredLeaveGrantedDate: '',
    bankName: '',
    bankBranch: '',
    bankAccountType: '普通',
    bankAccountNumber: '',
    station: '',
    driveUrl: '',
  });

  const [hasBonus, setHasBonus] = useState(false);
  const [originalDeptId, setOriginalDeptId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string>('active');
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [newQualification, setNewQualification] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revertModal, setRevertModal] = useState(false);
  // E: ロール変更関連の state
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('employee');
  const [roleDraft, setRoleDraft] = useState<string>('employee');
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiClient<EmployeeDetail>(`/employees/${id}`)
      .then((d) => {
        setForm({
          lastName: d.lastName || '',
          firstName: d.firstName || '',
          lastNameKana: d.lastNameKana || '',
          firstNameKana: d.firstNameKana || '',
          employeeCode: d.employeeCode || '',
          hireDate: fmtDateForDisplay(d.hireDate),
          resignDate: d.resignDate ? String(d.resignDate).slice(0, 10) : '',
          department: d.department?.name || 'SES事業部',
          employmentType: empTypeLabel[d.employmentType] || '正社員',
          status: statusLabel[d.status] || '在籍',
          education: educationLabel[d.education || ''] || d.education || '大卒',
          schoolName: d.schoolName || '',
          email: d.email || '',
          phone: d.phone || '',
          address: d.address || '',
          birthDate: fmtDateForDisplay(d.birthDate),
          gender: d.gender ? (genderLabel[d.gender] || '男性') : '男性',
          bloodType: 'A型',
          emergencyName: d.emergencyContacts?.[0]?.name || '',
          emergencyRelationship: d.emergencyContacts?.[0]?.relationship || '父',
          emergencyPhone: d.emergencyContacts?.[0]?.phone || '',
          baseSalary: d.baseSalary !== null && d.baseSalary !== undefined ? String(d.baseSalary) : '',
          rewardRate: d.rewardRate !== null && d.rewardRate !== undefined ? `${d.rewardRate}%` : '',
          contractHours: d.contractHours !== null && d.contractHours !== undefined ? String(d.contractHours) : '',
          fixedOvertime: d.fixedOvertime !== null && d.fixedOvertime !== undefined ? String(d.fixedOvertime) : '',
          rateHealthInsurance: d.rateHealthInsurance !== null && d.rateHealthInsurance !== undefined ? String(Number(d.rateHealthInsurance) * 100) : '',
          rateEmployeePension: d.rateEmployeePension !== null && d.rateEmployeePension !== undefined ? String(Number(d.rateEmployeePension) * 100) : '',
          rateEmploymentInsurance: d.rateEmploymentInsurance !== null && d.rateEmploymentInsurance !== undefined ? String(Number(d.rateEmploymentInsurance) * 100) : '',
          rateIncomeTax: d.rateIncomeTax !== null && d.rateIncomeTax !== undefined ? String(Number(d.rateIncomeTax) * 100) : '',
          rateResidentTaxFixed: d.rateResidentTaxFixed !== null && d.rateResidentTaxFixed !== undefined ? String(d.rateResidentTaxFixed) : '',
          commuteStyle: d.commuteStyle || '',
          leaveGrantMethod: d.leaveGrantMethod || 'hire_date',
          transferredLeaveDays: d.transferredLeaveDays !== null && d.transferredLeaveDays !== undefined ? String(d.transferredLeaveDays) : '',
          transferredLeaveGrantedDate: d.transferredLeaveGrantedDate ? String(d.transferredLeaveGrantedDate).slice(0, 10) : '',
          bankName: d.bankName || '',
          bankBranch: d.bankBranch || '',
          bankAccountType: accountTypeLabel[d.bankAccountType || ''] || '普通',
          bankAccountNumber: d.bankAccountNumber || '',
          station: d.station || '',
          driveUrl: '',
        });
        setHasBonus(d.hasBonus ?? false);
        setOriginalDeptId(d.department?.id || null);
        setOriginalStatus(d.status);
        setQualifications(Array.isArray(d.qualifications) ? d.qualifications : []);
        // E: ロール情報を state に反映
        setTargetUserId(d.user?.id ?? null);
        const role = d.user?.role ?? 'employee';
        setCurrentRole(role);
        setRoleDraft(role);
      })
      .catch((err) => {
        console.error('Failed to fetch employee detail:', err);
        setError(err?.message || '社員情報の取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key: keyof EditForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const newStatus = statusReverse[form.status] || form.status;

    // 退職にする場合は退職日が必須
    if (newStatus === 'resigned' && !form.resignDate) {
      toast('退職ステータスにする場合は退職日を入力してください');
      return;
    }

    // 退職→アクティブに戻す場合は退職日クリア有無を確認
    if (originalStatus === 'resigned' && newStatus !== 'resigned' && form.resignDate) {
      setRevertModal(true);
      return;
    }

    await doSubmit({});
  };

  const doSubmit = async (override: { clearResignDate?: boolean }) => {
    setSubmitting(true);
    try {
      const newStatus = statusReverse[form.status] || form.status;
      const resignDateToSend = override.clearResignDate
        ? null
        : (form.resignDate ? form.resignDate : null);

      const payload: Record<string, any> = {
        lastName: form.lastName,
        firstName: form.firstName,
        lastNameKana: form.lastNameKana,
        firstNameKana: form.firstNameKana,
        employmentType: empTypeReverse[form.employmentType] || form.employmentType,
        status: newStatus,
        resignDate: resignDateToSend,
        education: educationReverse[form.education] || form.education,
        schoolName: form.schoolName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        gender: genderReverse[form.gender] || form.gender,
        baseSalary: form.baseSalary ? Number(String(form.baseSalary).replace(/,/g, '')) : undefined,
        rewardRate: form.rewardRate ? Number(String(form.rewardRate).replace(/%/g, '')) : undefined,
        contractHours: form.contractHours ? Number(form.contractHours) : null,
        fixedOvertime: form.fixedOvertime ? Number(form.fixedOvertime) : null,
        rateHealthInsurance: form.rateHealthInsurance ? Number(form.rateHealthInsurance) / 100 : null,
        rateEmployeePension: form.rateEmployeePension ? Number(form.rateEmployeePension) / 100 : null,
        rateEmploymentInsurance: form.rateEmploymentInsurance ? Number(form.rateEmploymentInsurance) / 100 : null,
        rateIncomeTax: form.rateIncomeTax ? Number(form.rateIncomeTax) / 100 : null,
        rateResidentTaxFixed: form.rateResidentTaxFixed ? Number(form.rateResidentTaxFixed) : null,
        commuteStyle: form.commuteStyle || null,
        leaveGrantMethod: form.leaveGrantMethod || null,
        transferredLeaveDays: form.transferredLeaveDays ? Number(form.transferredLeaveDays) : null,
        transferredLeaveGrantedDate: form.transferredLeaveGrantedDate || null,
        station: form.station,
        hasBonus,
        qualifications,
      };

      // E: 銀行口座は admin + manager のみが編集可。member の場合は payload に含めず既存値を維持
      if (canViewPii) {
        payload.bankName = form.bankName;
        payload.bankBranch = form.bankBranch;
        payload.bankAccountType = accountTypeReverse[form.bankAccountType] || form.bankAccountType;
        payload.bankAccountNumber = form.bankAccountNumber;
      }

      // 部署IDは元の値を使用（部署セレクトはUUIDマッピングがないため）
      if (originalDeptId) {
        payload.departmentId = originalDeptId;
      }

      await apiClient(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast('保存しました');
      router.push(`/admin/employees/${id}`);
    } catch (err: any) {
      toast(err?.message || '保存に失敗しました');
    } finally {
      setSubmitting(false);
      setRevertModal(false);
    }
  };

  /**
   * E: ロール変更
   *
   * admin 専用。`PATCH /users/:userId/role` を呼び出し、サーバー側で
   * 最後の admin 保護・監査ログ記録が行われる。
   */
  const handleRoleChange = async () => {
    if (roleSubmitting) return;
    if (!targetUserId) {
      toast('この社員にはログインユーザーが紐付いていません');
      return;
    }
    if (roleDraft === currentRole) {
      toast('ロールが変更されていません');
      return;
    }
    setRoleSubmitting(true);
    try {
      const res = await apiClient<{ id: string; role: string; message?: string }>(
        `/users/${targetUserId}/role`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: roleDraft }),
        },
      );
      setCurrentRole(res.role);
      setRoleDraft(res.role);
      toast(res.message || 'ロールを変更しました');
    } catch (err: any) {
      // 最後の admin 降格拒否などのサーバーエラーをそのまま表示
      toast(err?.message || 'ロールの変更に失敗しました');
    } finally {
      setRoleSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-secondary">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button onClick={() => router.push(`/admin/employees/${id}`)} className="btn-outline text-sm py-2">戻る</button>
      </div>
    );
  }

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">社員情報の編集</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/admin/employees/${id}`)}
            className="btn-outline text-sm py-2"
          >
            キャンセル
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm py-2 disabled:opacity-50">
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* ===== 基本情報 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">基本情報</div>

          {/* 姓 / 名 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>
                姓{requiredMark}
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.lastName}
                onChange={set('lastName')}
              />
            </div>
            <div>
              <label className={labelCls}>
                名{requiredMark}
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.firstName}
                onChange={set('firstName')}
              />
            </div>
          </div>

          {/* 姓ふりがな / 名ふりがな */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>姓ふりがな</label>
              <input
                type="text"
                className={inputCls}
                value={form.lastNameKana}
                onChange={set('lastNameKana')}
              />
            </div>
            <div>
              <label className={labelCls}>名ふりがな</label>
              <input
                type="text"
                className={inputCls}
                value={form.firstNameKana}
                onChange={set('firstNameKana')}
              />
            </div>
          </div>

          {/* 社員番号 / 入社日 (readonly) */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>社員番号</label>
              <input
                type="text"
                className={readonlyCls}
                value={form.employeeCode}
                readOnly
              />
            </div>
            <div>
              <label className={labelCls}>入社日</label>
              <input
                type="text"
                className={readonlyCls}
                value={form.hireDate}
                readOnly
              />
            </div>
          </div>

          {/* 部署 */}
          <div className="mb-2">
            <label className={labelCls}>部署</label>
            <select
              className={selectCls}
              style={{ width: 200 }}
              value={form.department}
              onChange={set('department')}
            >
              <option>SES事業部</option>
              <option>管理部</option>
            </select>
          </div>

          {/* 雇用形態 / ステータス / 最終学歴 / 学校名 */}
          <div className="grid grid-cols-2 gap-2 mb-0">
            <div>
              <label className={labelCls}>雇用形態</label>
              <select
                className={selectCls}
                value={form.employmentType}
                onChange={set('employmentType')}
              >
                <option>正社員</option>
                <option>契約社員</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>ステータス</label>
              <select
                className={selectCls}
                value={form.status}
                onChange={set('status')}
              >
                <option>在籍</option>
                <option>待機中</option>
                <option>休職中</option>
                <option>退職</option>
              </select>
              <div className="text-[10px] text-secondary mt-[3px]">
                ※ 在籍/待機中は稼働管理と自動連動（本開発時）
              </div>
            </div>
            <div>
              <label className={labelCls}>
                退職日
                {form.status === '退職' && requiredMark}
              </label>
              <input
                type="date"
                className={inputCls}
                value={form.resignDate}
                onChange={set('resignDate')}
              />
              <div className="text-[10px] text-secondary mt-[3px]">
                ※ 退職日翌日0時にステータスが自動で「退職」になります
              </div>
            </div>
            <div>
              <label className={labelCls}>最終学歴</label>
              <select
                className={selectCls}
                value={form.education}
                onChange={set('education')}
              >
                <option>大卒</option>
                <option>大学院卒</option>
                <option>専門卒</option>
                <option>高卒</option>
                <option>短大卒</option>
                <option>高専卒</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>学校名</label>
              <input
                type="text"
                className={inputCls}
                placeholder="大阪工業大学"
                value={form.schoolName}
                onChange={set('schoolName')}
              />
            </div>
          </div>
        </div>

        {/* ===== E: 権限・ロール ===== */}
        {targetUserId && (
          <div className="card p-5 mb-3">
            <div className="text-sm font-medium mb-3">権限・ロール</div>

            {canChangeRole ? (
              <>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div>
                    <label className={labelCls}>ロール</label>
                    <select
                      className={selectCls}
                      value={roleDraft}
                      onChange={(e) => setRoleDraft(e.target.value)}
                      disabled={roleSubmitting}
                    >
                      <option value="admin">管理者 (admin)</option>
                      <option value="manager">マネージャー (manager)</option>
                      <option value="member">メンバー (member)</option>
                      <option value="employee">一般社員 (employee)</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleRoleChange}
                      disabled={roleSubmitting || roleDraft === currentRole}
                      className="btn-primary text-sm py-2 disabled:opacity-50"
                    >
                      {roleSubmitting ? '変更中...' : 'ロールを変更'}
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-secondary mt-[6px]">
                  ※ 現在のロール: <span className="text-primary font-medium">{roleLabel[currentRole] || currentRole}</span>
                  <br />
                  ※ admin: 全権限 / manager・member: 全権限（給与は階層で制限）/ employee: 管理側ログイン不可（/mypage のみ）
                  <br />
                  ※ 最後の admin を降格することはできません
                </div>
              </>
            ) : (
              <>
                <label className={labelCls}>ロール</label>
                <input
                  type="text"
                  className={readonlyCls}
                  value={roleLabel[currentRole] || currentRole}
                  readOnly
                />
                <div className="text-[10px] text-secondary mt-[3px]">
                  ※ ロールの変更は admin 権限を持つユーザーのみ可能です
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== 連絡先 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">連絡先</div>

          {/* メールアドレス / 電話番号 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>メールアドレス</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={set('email')}
              />
            </div>
            <div>
              <label className={labelCls}>電話番号</label>
              <input
                type="text"
                className={inputCls}
                value={form.phone}
                onChange={set('phone')}
              />
            </div>
          </div>

          {/* 住所 / 最寄駅 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>住所</label>
              <input
                type="text"
                className={inputCls}
                value={form.address}
                onChange={set('address')}
              />
            </div>
            <div>
              <label className={labelCls}>最寄駅</label>
              <input
                type="text"
                className={inputCls}
                placeholder="JR大阪駅"
                value={form.station}
                onChange={set('station')}
              />
            </div>
          </div>
        </div>

        {/* ===== 個人情報 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">個人情報</div>

          {/* 生年月日 / 年齢(readonly) / 性別 / 血液型 */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>生年月日</label>
              <input
                type="text"
                className={inputCls}
                placeholder="1996年4月15日"
                value={form.birthDate}
                onChange={set('birthDate')}
              />
            </div>
            <div>
              <label className={labelCls}>年齢</label>
              <input
                type="text"
                className={readonlyCls}
                value={calcAge(form.birthDate)}
                readOnly
              />
            </div>
            <div>
              <label className={labelCls}>性別</label>
              <select
                className={selectCls}
                value={form.gender}
                onChange={set('gender')}
              >
                <option>男性</option>
                <option>女性</option>
                <option>その他</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>血液型</label>
              <select
                className={selectCls}
                value={form.bloodType}
                onChange={set('bloodType')}
              >
                <option>A型</option>
                <option>B型</option>
                <option>O型</option>
                <option>AB型</option>
              </select>
            </div>
          </div>
        </div>

        {/* ===== 緊急連絡先 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">緊急連絡先</div>

          {/* 氏名 / 続柄 / 電話番号 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>氏名</label>
              <input
                type="text"
                className={inputCls}
                placeholder="山田 花子"
                value={form.emergencyName}
                onChange={set('emergencyName')}
              />
            </div>
            <div>
              <label className={labelCls}>続柄</label>
              <select
                className={selectCls}
                value={form.emergencyRelationship}
                onChange={set('emergencyRelationship')}
              >
                <option>父</option>
                <option>母</option>
                <option>配偶者</option>
                <option>兄弟姉妹</option>
                <option>その他</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>電話番号</label>
              <input
                type="text"
                className={inputCls}
                placeholder="090-1111-9999"
                value={form.emergencyPhone}
                onChange={set('emergencyPhone')}
              />
            </div>
          </div>
        </div>

        {/* ===== 給与・口座 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">給与・口座</div>

          {/* 基本給（月額） / 還元率 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>基本給（月額）</label>
              <input
                type="text"
                className={inputCls}
                value={form.baseSalary}
                onChange={set('baseSalary')}
              />
            </div>
            <div>
              <label className={labelCls}>還元率</label>
              <input
                type="text"
                className={inputCls}
                placeholder="空白なら計算しない"
                value={form.rewardRate}
                onChange={set('rewardRate')}
              />
              <div className="text-[10px] text-secondary mt-[3px]">
                ※ 空白の場合は還元率計算を行いません
              </div>
            </div>
          </div>

          {/* 所定労働時間 / 固定残業時間 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>所定労働時間（時間/月）</label>
              <input
                type="number"
                className={inputCls}
                placeholder="168"
                value={form.contractHours}
                onChange={set('contractHours')}
              />
              <div className="text-[10px] text-secondary mt-[3px]">
                ※ 未入力時はデフォルト168h/月で計算
              </div>
            </div>
            <div>
              <label className={labelCls}>固定残業時間（時間/月）</label>
              <input
                type="number"
                className={inputCls}
                placeholder="20"
                value={form.fixedOvertime}
                onChange={set('fixedOvertime')}
              />
              <div className="text-[10px] text-secondary mt-[3px]">
                ※ 未入力時はデフォルト20h/月で計算
              </div>
            </div>
          </div>

          {/* J1: 社員別料率上書き */}
          <div className="mt-3 mb-2 p-3 border border-border/30 rounded-md bg-[#FAFAFA]">
            <div className="text-xs font-medium text-primary mb-2">
              料率の社員別上書き（空白の場合はデフォルト値を使用）
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className={labelCls}>健康保険(%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  placeholder="デフォルト"
                  value={form.rateHealthInsurance}
                  onChange={set('rateHealthInsurance')}
                />
              </div>
              <div>
                <label className={labelCls}>厚生年金(%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  placeholder="デフォルト"
                  value={form.rateEmployeePension}
                  onChange={set('rateEmployeePension')}
                />
              </div>
              <div>
                <label className={labelCls}>雇用保険(%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  placeholder="デフォルト"
                  value={form.rateEmploymentInsurance}
                  onChange={set('rateEmploymentInsurance')}
                />
              </div>
              <div>
                <label className={labelCls}>所得税(%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  placeholder="デフォルト"
                  value={form.rateIncomeTax}
                  onChange={set('rateIncomeTax')}
                />
              </div>
              <div>
                <label className={labelCls}>住民税(円)</label>
                <input
                  type="number"
                  step="1"
                  className={inputCls}
                  placeholder="デフォルト"
                  value={form.rateResidentTaxFixed}
                  onChange={set('rateResidentTaxFixed')}
                />
              </div>
            </div>
          </div>

          {/* 通勤スタイル */}
          <div className="mb-2">
            <label className={labelCls}>通勤スタイル</label>
            <select
              className={selectCls}
              style={{ width: 240 }}
              value={form.commuteStyle}
              onChange={set('commuteStyle')}
            >
              <option value="">未設定</option>
              <option value="onetime">都度（申請の度）</option>
              <option value="monthly">1ヶ月定期</option>
              <option value="three_month">3ヶ月定期</option>
            </select>
            <div className="text-[10px] text-secondary mt-[3px]">
              ※ 定期設定時は申請漏れアラートが自動表示されます
            </div>
          </div>

          {/* 銀行名 / 支店名 / 口座種別 / 口座番号
              E: 閲覧・編集は admin + manager のみ。member 以下は「閲覧権限なし」表示 */}
          {canViewPii ? (
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>銀行名</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.bankName}
                  onChange={set('bankName')}
                />
              </div>
              <div>
                <label className={labelCls}>支店名</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.bankBranch}
                  onChange={set('bankBranch')}
                />
              </div>
              <div>
                <label className={labelCls}>口座種別</label>
                <select
                  className={selectCls}
                  value={form.bankAccountType}
                  onChange={set('bankAccountType')}
                >
                  <option>普通</option>
                  <option>当座</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>口座番号</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.bankAccountNumber}
                  onChange={set('bankAccountNumber')}
                />
              </div>
            </div>
          ) : (
            <div className="p-3 border border-border/30 rounded-md bg-[#F7F7F5] text-[12px] text-secondary">
              銀行口座情報の閲覧・編集には manager 以上の権限が必要です
            </div>
          )}

          {/* 賞与支給 */}
          <div className="mt-3">
            <label className={labelCls}>賞与支給</label>
            <button
              type="button"
              onClick={() => setHasBonus(!hasBonus)}
              className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
                hasBonus
                  ? 'bg-status-green-bg text-status-green-text'
                  : 'bg-muted text-secondary'
              }`}
            >
              {hasBonus ? 'あり' : 'なし'}
            </button>
          </div>
        </div>

        {/* ===== 有給設定 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">有給設定</div>

          {/* 付与方式 */}
          <div className="mb-2">
            <label className={labelCls}>付与方式</label>
            <select
              className={selectCls}
              style={{ width: 240 }}
              value={form.leaveGrantMethod}
              onChange={set('leaveGrantMethod')}
            >
              <option value="hire_date">入社日基準</option>
              <option value="transferred">前職引継ぎ</option>
            </select>
            <div className="text-[10px] text-secondary mt-[3px]">
              ※ 入社日基準=労基法の勤続年数に従って付与 / 前職引継ぎ=前職の残日数を引き継ぐ
            </div>
          </div>

          {/* 引継ぎ情報（前職引継ぎ選択時のみ表示） */}
          {form.leaveGrantMethod === 'transferred' && (
            <div className="grid grid-cols-2 gap-2 mb-0">
              <div>
                <label className={labelCls}>引継ぎ残日数</label>
                <input
                  type="number"
                  step="0.5"
                  className={inputCls}
                  placeholder="10"
                  value={form.transferredLeaveDays}
                  onChange={set('transferredLeaveDays')}
                />
                <div className="text-[10px] text-secondary mt-[3px]">
                  ※ 半休対応のため0.5刻みで入力可
                </div>
              </div>
              <div>
                <label className={labelCls}>前職付与日</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.transferredLeaveGrantedDate}
                  onChange={set('transferredLeaveGrantedDate')}
                />
                <div className="text-[10px] text-secondary mt-[3px]">
                  ※ 不明な場合は転籍日を入力
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 書類（Google Drive） ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">書類（Google Drive）</div>

          <div>
            <label className={labelCls}>書類フォルダURL</label>
            <input
              type="text"
              className={readonlyCls}
              value={form.driveUrl}
              readOnly
              placeholder="入社情報フォーム送信時に自動セット"
            />
          </div>
        </div>

        {/* ===== 保有資格 ===== */}
        <div className="card p-5 mb-3">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium">保有資格</div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              className={inputCls}
              placeholder="資格名を入力"
              value={newQualification}
              onChange={(e) => setNewQualification(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newQualification.trim()) {
                  setQualifications((prev) => [...prev, newQualification.trim()]);
                  setNewQualification('');
                  toast(`「${newQualification.trim()}」を追加しました`);
                }
              }}
            />
            <button
              className="btn-outline text-[11px] py-2 px-3 whitespace-nowrap"
              onClick={() => {
                if (newQualification.trim()) {
                  setQualifications((prev) => [...prev, newQualification.trim()]);
                  toast(`「${newQualification.trim()}」を追加しました`);
                  setNewQualification('');
                }
              }}
            >
              資格追加
            </button>
          </div>

          {qualifications.length === 0 ? (
            <div className="text-sm text-secondary py-2">資格データはありません</div>
          ) : (
            <ul className="space-y-1.5">
              {qualifications.map((q, idx) => (
                <li key={`${q}-${idx}`} className="flex items-center justify-between px-3 py-2 bg-[#F7F7F5] rounded-md">
                  <span className="text-sm">{q}</span>
                  <button
                    className="text-secondary hover:text-[#A32D2D] text-lg leading-none px-1"
                    onClick={() => {
                      setQualifications((prev) => prev.filter((_, i) => i !== idx));
                      toast(`「${q}」を削除しました`);
                    }}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[10px] text-secondary mt-[6px]">
            ※ スキルシートの資格欄に自動反映されます
          </div>
        </div>
      </div>

      {/* 下部の戻るボタン */}
      <div className="mt-4">
        <button
          onClick={() => router.push(`/admin/employees/${id}`)}
          className="btn-outline text-sm py-2"
        >
          戻る
        </button>
      </div>

      {/* 退職→在籍 復帰モーダル */}
      {revertModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-md font-semibold mb-3">ステータスを在籍に戻します</h3>
            <p className="text-sm text-secondary mb-5">
              現在の退職日（{form.resignDate}）はどう扱いますか？
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setRevertModal(false)}
                className="btn-outline text-sm py-2"
                disabled={submitting}
              >
                キャンセル
              </button>
              <button
                onClick={() => doSubmit({ clearResignDate: false })}
                className="btn-outline text-sm py-2"
                disabled={submitting}
              >
                退職日を残す
              </button>
              <button
                onClick={() => doSubmit({ clearResignDate: true })}
                className="btn-primary text-sm py-2"
                disabled={submitting}
              >
                退職日をクリアする
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastUI />
    </div>
  );
}
