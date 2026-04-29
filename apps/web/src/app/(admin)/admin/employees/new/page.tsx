/**
 * 管理側 新規社員登録ページ
 *
 * HTMLプロトタイプ page-form-employee を完全再現。
 * セクション: 基本情報 → 連絡先 → 給与・口座
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- フォーム状態の型 ---------- */

interface EmployeeForm {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  employeeCode: string;
  hireDate: string;
  department: string;
  employmentType: string;
  birthDate: string;
  education: string;
  schoolName: string;
  email: string;
  phone: string;
  address: string;
  baseSalary: string;
  rewardRate: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
}

const initialForm: EmployeeForm = {
  lastName: '',
  firstName: '',
  lastNameKana: '',
  firstNameKana: '',
  employeeCode: '',
  hireDate: '',
  department: 'SES事業部',
  employmentType: '正社員',
  birthDate: '',
  education: '大卒',
  schoolName: '',
  email: '',
  phone: '',
  address: '',
  baseSalary: '',
  rewardRate: '',
  bankName: '',
  bankBranch: '',
  bankAccountNumber: '',
};

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

/** 部署名 → departmentId のマッピング */
const deptMap: Record<string, string> = {
  'SES事業部': 'd0000001-0000-0000-0000-000000000001',
  '管理部': 'd0000001-0000-0000-0000-000000000005',
};

/** 雇用形態ラベル → DB値 */
const empTypeMap: Record<string, string> = {
  '正社員': 'regular',
  '契約社員': 'contract',
};

/** 学歴ラベル → DB値 */
const educationMap: Record<string, string> = {
  '大卒': 'university',
  '大学院卒': 'grad_school',
  '専門卒': 'vocational',
  '短大卒': 'junior_college',
  '高専卒': 'technical_college',
  '高卒': 'high_school',
};

export default function NewEmployeePage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [form, setForm] = useState<EmployeeForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof EmployeeForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.lastName || !form.firstName) { toast('姓・名は必須です'); return; }
    if (!form.hireDate) { toast('入社日は必須です'); return; }
    if (!form.email) { toast('メールアドレスは必須です'); return; }
    setSubmitting(true);
    try {
      // フォーム値をAPI形式に変換
      const payload = {
        lastName: form.lastName,
        firstName: form.firstName,
        lastNameKana: form.lastNameKana || undefined,
        firstNameKana: form.firstNameKana || undefined,
        employeeCode: form.employeeCode || undefined,
        hireDate: form.hireDate,
        departmentId: deptMap[form.department] || form.department,
        employmentType: empTypeMap[form.employmentType] || form.employmentType,
        birthDate: form.birthDate || undefined,
        education: form.education ? (educationMap[form.education] || form.education) : undefined,
        schoolName: form.schoolName || undefined,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        baseSalary: form.baseSalary ? Number(form.baseSalary.replace(/,/g, '')) : undefined,
        rewardRate: form.rewardRate ? Number(form.rewardRate.replace(/%/g, '')) : undefined,
        bankName: form.bankName || undefined,
        bankBranch: form.bankBranch || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
      };

      await apiClient('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast('社員を登録しました');
      router.push('/admin/employees');
    } catch (err: any) {
      toast(err?.message || '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">新規社員登録</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/employees')}
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
                placeholder="山田"
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
                placeholder="太郎"
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
                placeholder="やまだ"
                value={form.lastNameKana}
                onChange={set('lastNameKana')}
              />
            </div>
            <div>
              <label className={labelCls}>名ふりがな</label>
              <input
                type="text"
                className={inputCls}
                placeholder="たろう"
                value={form.firstNameKana}
                onChange={set('firstNameKana')}
              />
            </div>
          </div>

          {/* 社員番号 / 入社日 */}
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
              <label className={labelCls}>
                入社日{requiredMark}
              </label>
              <input
                type="date"
                className={inputCls}
                value={form.hireDate}
                onChange={set('hireDate')}
              />
            </div>
          </div>

          {/* 部署 */}
          <div className="mb-2">
            <label className={labelCls}>
              部署{requiredMark}
            </label>
            <select
              className={selectCls}
              style={{ width: 200 }}
              value={form.department}
              onChange={set('department')}
            >
              <option>SES事業部</option>
              <option>開発部</option>
              <option>管理部</option>
            </select>
          </div>

          {/* 雇用形態 / 生年月日 / 最終学歴 */}
          <div className="grid grid-cols-3 gap-2">
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
              <label className={labelCls}>生年月日</label>
              <input
                type="date"
                className={inputCls}
                value={form.birthDate}
                onChange={set('birthDate')}
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
                <option>短大卒</option>
                <option>高専卒</option>
                <option>高卒</option>
              </select>
            </div>
          </div>

          {/* 学校名 */}
          <div className="mb-2">
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

        {/* ===== 連絡先 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">連絡先</div>

          {/* メールアドレス / 電話番号 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>
                メールアドレス{requiredMark}
              </label>
              <input
                type="email"
                className={inputCls}
                placeholder="t.yamada@sample-ses.co.jp"
                value={form.email}
                onChange={set('email')}
              />
            </div>
            <div>
              <label className={labelCls}>電話番号</label>
              <input
                type="text"
                className={inputCls}
                placeholder="090-1234-5678"
                value={form.phone}
                onChange={set('phone')}
              />
            </div>
          </div>

          {/* 住所 */}
          <div>
            <label className={labelCls}>住所</label>
            <input
              type="text"
              className={inputCls}
              placeholder="大阪府大阪市北区梅田1-1-1"
              value={form.address}
              onChange={set('address')}
            />
          </div>
        </div>

        {/* ===== 給与・口座 ===== */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">給与・口座</div>

          {/* 基本給 / 還元率 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={labelCls}>基本給</label>
              <input
                type="text"
                className={inputCls}
                placeholder="300,000"
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

          {/* 銀行名 / 支店名 / 口座番号 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>銀行名</label>
              <input
                type="text"
                className={inputCls}
                placeholder="三菱UFJ銀行"
                value={form.bankName}
                onChange={set('bankName')}
              />
            </div>
            <div>
              <label className={labelCls}>支店名</label>
              <input
                type="text"
                className={inputCls}
                placeholder="梅田支店"
                value={form.bankBranch}
                onChange={set('bankBranch')}
              />
            </div>
            <div>
              <label className={labelCls}>口座番号</label>
              <input
                type="text"
                className={inputCls}
                placeholder="1234567"
                value={form.bankAccountNumber}
                onChange={set('bankAccountNumber')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 下部にも戻るボタン */}
      <div className="mt-4">
        <button
          onClick={() => router.push('/admin/employees')}
          className="btn-outline text-sm py-2"
        >
          戻る
        </button>
      </div>

      <ToastUI />
    </div>
  );
}
