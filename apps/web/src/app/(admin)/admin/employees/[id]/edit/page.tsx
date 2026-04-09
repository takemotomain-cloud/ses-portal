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
}

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
        bankName: form.bankName,
        bankBranch: form.bankBranch,
        bankAccountType: accountTypeReverse[form.bankAccountType] || form.bankAccountType,
        bankAccountNumber: form.bankAccountNumber,
        station: form.station,
        hasBonus,
        qualifications,
      };

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
                placeholder="72%"
                value={form.rewardRate}
                onChange={set('rewardRate')}
              />
            </div>
          </div>

          {/* 銀行名 / 支店名 / 口座種別 / 口座番号 */}
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
