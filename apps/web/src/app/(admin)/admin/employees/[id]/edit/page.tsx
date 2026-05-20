/**
 * 管理側 社員情報の編集ページ
 *
 * HTMLプロトタイプ page-emp-edit を完全再現。
 * セクション: 基本情報 → 連絡先 → 個人情報 → 緊急連絡先 → 給与・口座
 *           → 書類（Google Drive） → 保有資格
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
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
  bloodType: string | null;
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
  salaryGradeId: string | null;
  fixedOvertimePay: number | null;
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
  departmentId: string;
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
  salaryGradeId: string;
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
  bankAccountHolder: string;
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

interface Department {
  id: string;
  name: string;
}

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
    departmentId: '',
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
    salaryGradeId: '',
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
    bankAccountHolder: '',
    station: '',
    driveUrl: '',
  });

  const [hasBonus, setHasBonus] = useState(false);
  const [originalDeptId, setOriginalDeptId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string>('active');
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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

  // 扶養家族管理
  interface DependentRow {
    id: string;
    name: string;
    relationship: string;
    birthDate: string;
    annualIncome: number | null;
    isNew?: boolean;
  }
  const [dependents, setDependents] = useState<DependentRow[]>([]);
  const [depSaving, setDepSaving] = useState(false);

  // 住民税（特別徴収）管理
  interface ResidentTaxMonth { month: number; amount: number; id: string | null }
  const [residentTaxYear, setResidentTaxYear] = useState<number>(() => {
    const now = new Date();
    return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1; // 6月〜=当年, 1〜5月=前年
  });
  const [residentTaxes, setResidentTaxes] = useState<ResidentTaxMonth[]>([]);
  const [rtSaving, setRtSaving] = useState(false);

  // 給与等級マスタ
  interface SalaryGradeItem {
    id: string;
    department: string;
    grade: number;
    overtimeType: number;
    grossSalary: number;
    baseSalary: number;
    fixedOvertimePay: number;
    positionAllowance: number;
  }
  const [salaryGrades, setSalaryGrades] = useState<SalaryGradeItem[]>([]);
  const [gradeDept, setGradeDept] = useState<string>('ses');
  const [gradeOtType, setGradeOtType] = useState<number>(20);

  useEffect(() => {
    if (!currentUser) return;
    // 部署一覧を取得
    apiClient<Department[]>('/settings/departments')
      .then(data => {
        setDepartments(data);
      })
      .catch(err => console.error('部署一覧の取得に失敗しました', err));

    apiClient<SalaryGradeItem[]>('/employees/salary-grades')
      .then((data) => { console.log('salary-grades loaded:', data?.length); setSalaryGrades(Array.isArray(data) ? data : []); })
      .catch((e) => console.error('salary-grades fetch error:', e));
  }, [currentUser]);

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
          departmentId: d.department?.id || '',
          employmentType: empTypeLabel[d.employmentType] || '正社員',
          status: statusLabel[d.status] || '在籍',
          education: educationLabel[d.education || ''] || d.education || '大卒',
          schoolName: d.schoolName || '',
          email: d.email || '',
          phone: d.phone || '',
          address: d.address || '',
          birthDate: fmtDateForDisplay(d.birthDate),
          gender: d.gender ? (genderLabel[d.gender] || '男性') : '男性',
          bloodType: d.bloodType || 'A型',
          emergencyName: d.emergencyContacts?.[0]?.name || '',
          emergencyRelationship: d.emergencyContacts?.[0]?.relationship || '父',
          emergencyPhone: d.emergencyContacts?.[0]?.phone || '',
          salaryGradeId: d.salaryGradeId || '',
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
          bankAccountHolder: d.bankAccountHolder || '',
          station: d.station || '',
          driveUrl: '',
        });
        setHasBonus(d.hasBonus ?? false);
        // 等級から部門・残業タイプを推定
        if (d.salaryGradeId && salaryGrades.length > 0) {
          const g = salaryGrades.find(sg => sg.id === d.salaryGradeId);
          if (g) { setGradeDept(g.department); setGradeOtType(g.overtimeType); }
        } else if (d.fixedOvertime && d.fixedOvertime >= 40) {
          setGradeDept('admin'); setGradeOtType(40);
        }
        setOriginalDeptId(d.department?.id || null);
        setOriginalStatus(d.status);
        setQualifications(Array.isArray(d.qualifications) ? d.qualifications : []);
        // E: ロール情報を state に反映
        setTargetUserId(d.user?.id ?? null);
        const role = d.user?.role ?? 'employee';
        setCurrentRole(role);
        setRoleDraft(role);
        // 扶養家族を読み込み
        if (d.dependents) {
          setDependents(d.dependents.filter((dep: any) => !dep.deletedAt).map((dep: any) => ({
            id: dep.id,
            name: dep.name,
            relationship: dep.relationship,
            birthDate: dep.birthDate ? String(dep.birthDate).slice(0, 10) : '',
            annualIncome: dep.annualIncome,
          })));
        }
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

  // 住民税の年度切替時にフェッチ
  const fetchResidentTaxes = useCallback(async (fy: number) => {
    try {
      const data = await apiClient<ResidentTaxMonth[]>(`/employees/${id}/resident-taxes?fiscalYear=${fy}`);
      setResidentTaxes(data);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchResidentTaxes(residentTaxYear);
  }, [id, residentTaxYear, fetchResidentTaxes]);

  // 住民税保存
  const handleSaveResidentTaxes = async () => {
    setRtSaving(true);
    try {
      const amounts: Record<string, number> = {};
      residentTaxes.forEach(rt => { amounts[String(rt.month)] = rt.amount; });
      const data = await apiClient<ResidentTaxMonth[]>(`/employees/${id}/resident-taxes`, {
        method: 'PATCH',
        body: JSON.stringify({ fiscalYear: residentTaxYear, amounts }),
      });
      setResidentTaxes(data);
      toast('住民税を保存しました');
    } catch (err: any) {
      toast(err?.message || '住民税の保存に失敗しました');
    } finally {
      setRtSaving(false);
    }
  };

  // 扶養家族追加
  const handleAddDependent = async () => {
    setDepSaving(true);
    try {
      const dep = await apiClient<DependentRow>(`/employees/${id}/dependents`, {
        method: 'POST',
        body: JSON.stringify({ name: '（氏名未入力）', relationship: '子', birthDate: '2000-01-01' }),
      });
      setDependents(prev => [...prev, { ...dep, birthDate: String(dep.birthDate).slice(0, 10) }]);
      toast('扶養家族を追加しました');
    } catch (err: any) {
      toast(err?.message || '追加に失敗しました');
    } finally {
      setDepSaving(false);
    }
  };

  // 扶養家族更新
  const handleUpdateDependent = async (depId: string, field: string, value: string | number) => {
    try {
      await apiClient(`/employees/${id}/dependents/${depId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err: any) {
      toast(err?.message || '更新に失敗しました');
    }
  };

  // 扶養家族削除
  const handleDeleteDependent = async (depId: string) => {
    try {
      await apiClient(`/employees/${id}/dependents/${depId}`, { method: 'DELETE' });
      setDependents(prev => prev.filter(d => d.id !== depId));
      toast('扶養家族を削除しました');
    } catch (err: any) {
      toast(err?.message || '削除に失敗しました');
    }
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
        bloodType: form.bloodType,
        salaryGradeId: form.salaryGradeId || null,
        rewardRate: form.rewardRate ? Number(String(form.rewardRate).replace(/%/g, '')) : undefined,
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
        payload.bankAccountHolder = form.bankAccountHolder;
      }

      payload.departmentId = form.departmentId;

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
              value={form.departmentId}
              onChange={set('departmentId')}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
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

        {/* ===== E: 権限・ロール（表示のみ） ===== */}
        {targetUserId && (
          <div className="card p-5 mb-3">
            <div className="text-sm font-medium mb-3">権限・ロール</div>
            <label className={labelCls}>ロール</label>
            <input
              type="text"
              className={readonlyCls}
              value={roleLabel[currentRole] || currentRole}
              readOnly
            />
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
          <div className="text-sm font-medium mb-1">給与・口座</div>
          <p className="text-[10px] text-secondary/60 mb-3">給与等級を選択すると基本給・固定残業手当が自動で設定されます。以下の項目は給与計算に直接反映されます。</p>

          {/* 給与等級選択 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>部門</label>
              <select
                className={selectCls}
                value={gradeDept}
                onChange={(e) => {
                  setGradeDept(e.target.value);
                  if (e.target.value === 'ses') setGradeOtType(20);
                  setForm(f => ({ ...f, salaryGradeId: '' }));
                }}
              >
                <option value="ses">SES事業部</option>
                <option value="admin">管理部</option>
              </select>
            </div>
            {gradeDept === 'admin' && (
              <div>
                <label className={labelCls}>固定残業タイプ</label>
                <select
                  className={selectCls}
                  value={gradeOtType}
                  onChange={(e) => {
                    setGradeOtType(Number(e.target.value));
                    setForm(f => ({ ...f, salaryGradeId: '' }));
                  }}
                >
                  <option value={20}>20時間</option>
                  <option value={40}>40時間</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>等級</label>
              <select
                className={selectCls}
                value={form.salaryGradeId}
                onChange={(e) => setForm(f => ({ ...f, salaryGradeId: e.target.value }))}
              >
                <option value="">未選択</option>
                {salaryGrades
                  .filter(g => g.department === gradeDept && g.overtimeType === gradeOtType)
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.grade}等級 — 総支給 {g.grossSalary.toLocaleString()}円
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>還元率</label>
              <select
                className={selectCls}
                value={form.rewardRate}
                onChange={set('rewardRate')}
              >
                <option value="">未設定</option>
                {Array.from({ length: 51 }, (_, i) => 100 - i).map(v => (
                  <option key={v} value={`${v}%`}>{v}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* 選択中の等級情報 */}
          {(() => {
            const sel = salaryGrades.find(g => g.id === form.salaryGradeId);
            if (!sel) return null;
            return (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className={labelCls}>基本給</label>
                  <input type="text" className={readonlyCls} value={`${sel.baseSalary.toLocaleString()}円`} readOnly />
                </div>
                <div>
                  <label className={labelCls}>固定残業手当（{sel.overtimeType}時間分）</label>
                  <input type="text" className={readonlyCls} value={`${sel.fixedOvertimePay.toLocaleString()}円`} readOnly />
                </div>
              </div>
            );
          })()}

          {/* 扶養家族 */}
          <div className="mt-3 mb-2 p-3 border border-border/30 rounded-md bg-[#FAFAFA]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-primary">扶養家族（扶養人数: {dependents.length}人）</div>
              <button
                type="button"
                onClick={handleAddDependent}
                disabled={depSaving}
                className="text-xs text-primary hover:underline disabled:opacity-50 whitespace-nowrap"
              >
                + 追加
              </button>
            </div>
            <p className="text-[10px] text-secondary/60 mb-2">入社時・家族構成変更時に登録。扶養人数に応じて源泉徴収税額（所得税）が変わります。年収103万円超の家族は税法上の扶養対象外です。</p>
            {dependents.length === 0 ? (
              <p className="text-xs text-secondary/60">扶養家族なし</p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_80px_110px_100px_40px] gap-1 text-[10px] text-secondary font-medium px-1">
                  <span>氏名</span><span>続柄</span><span>生年月日</span><span>年収(万円)</span><span></span>
                </div>
                {dependents.map((dep) => (
                  <div key={dep.id} className="grid grid-cols-[1fr_80px_110px_100px_40px] gap-1 items-center">
                    <input
                      className={inputCls}
                      value={dep.name}
                      onChange={(e) => {
                        setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, name: e.target.value } : d));
                      }}
                      onBlur={() => handleUpdateDependent(dep.id, 'name', dep.name)}
                    />
                    <select
                      className={selectCls}
                      value={dep.relationship}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, relationship: val } : d));
                        handleUpdateDependent(dep.id, 'relationship', val);
                      }}
                    >
                      {['配偶者','子','父','母','祖父','祖母','兄弟姉妹','その他'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className={inputCls}
                      value={dep.birthDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, birthDate: val } : d));
                      }}
                      onBlur={() => dep.birthDate && handleUpdateDependent(dep.id, 'birthDate', dep.birthDate)}
                    />
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="0"
                      value={dep.annualIncome !== null ? String(Math.round((dep.annualIncome ?? 0) / 10000)) : ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) * 10000 : null;
                        setDependents(prev => prev.map(d => d.id === dep.id ? { ...d, annualIncome: val } : d));
                      }}
                      onBlur={() => handleUpdateDependent(dep.id, 'annualIncome', dep.annualIncome ?? 0)}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteDependent(dep.id)}
                      className="text-xs text-[#A32D2D] hover:underline"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 住民税（特別徴収）12ヶ月入力 */}
          <div className="mt-3 mb-2 p-3 border border-border/30 rounded-md bg-[#FAFAFA]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-primary">住民税（特別徴収）</div>
              <select
                className="border border-border/30 rounded px-2 py-1 text-xs"
                value={residentTaxYear}
                onChange={(e) => setResidentTaxYear(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}年度（{y}年6月〜{y + 1}年5月）</option>;
                })}
              </select>
            </div>
            <p className="text-[10px] text-secondary/60 mb-2">毎年5月頃届く「特別徴収税額決定通知書」の月額を転記してください。未入力月はデフォルト固定額（設定ページで管理）が適用されます。</p>
            <div className="grid grid-cols-6 gap-1">
              {[6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5].map((m) => {
                const rt = residentTaxes.find(r => r.month === m);
                return (
                  <div key={m}>
                    <label className="text-[10px] text-secondary">{m}月</label>
                    <input
                      type="number"
                      step="1"
                      className={inputCls}
                      placeholder="0"
                      value={rt?.amount ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setResidentTaxes(prev => {
                          const exists = prev.find(r => r.month === m);
                          if (exists) return prev.map(r => r.month === m ? { ...r, amount: val } : r);
                          return [...prev, { month: m, amount: val, id: null }];
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-secondary">
                年間合計: {residentTaxes.reduce((s, r) => s + r.amount, 0).toLocaleString()}円
              </span>
              <button
                type="button"
                onClick={handleSaveResidentTaxes}
                disabled={rtSaving}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {rtSaving ? '保存中...' : '住民税を保存'}
              </button>
            </div>
          </div>

          {/* J1: 社員別料率上書き */}
          <div className="mt-3 mb-2 p-3 border border-border/30 rounded-md bg-[#FAFAFA]">
            <div className="text-xs font-medium text-primary mb-1">
              料率の社員別上書き
            </div>
            <p className="text-[10px] text-secondary/60 mb-2">通常は空白のままで問題ありません（標準報酬月額テーブル・源泉徴収税額表から自動計算されます）。社労士から個別指示があった場合のみ入力してください。入力すると自動計算を無効化します。</p>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>健康保険(%)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  placeholder="自動計算"
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
                  placeholder="自動計算"
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
                  placeholder="0.60"
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
                  placeholder="自動計算"
                  value={form.rateIncomeTax}
                  onChange={set('rateIncomeTax')}
                />
                <p className="text-[9px] text-[#A32D2D] mt-0.5">入力すると源泉徴収税額表を無効化</p>
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
