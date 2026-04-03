/**
 * 管理側 入社情報の登録フォーム
 *
 * HTMLプロトタイプ page-onboard-form を完全再現。
 * セクション: 基本情報 → 緊急連絡先 → 給与振込口座
 *           → 本人確認書類 → マイナンバー → 年金手帳 → 健康診断結果
 *           → 注意書き → 送信ボタン
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- フォーム状態型 ---------- */

interface OnboardFormState {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  bloodType: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
}

const initialForm: OnboardFormState = {
  lastName: '長谷川',
  firstName: '翼',
  lastNameKana: '',
  firstNameKana: '',
  birthDate: '',
  gender: '男性',
  address: '',
  phone: '',
  email: '',
  bloodType: 'A型',
  emergencyName: '',
  emergencyRelation: '父',
  emergencyPhone: '',
  bankName: '',
  bankBranch: '',
  bankAccountType: '普通',
  bankAccountNumber: '',
};

/* ---------- サブコンポーネント ---------- */

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[11px] text-secondary block mb-[3px]">
      {children}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );
}

function FormInput({
  type = 'text',
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none ${
        readOnly ? 'bg-[#F7F7F5]' : ''
      }`}
    />
  );
}

function FormSelect({
  value,
  onChange,
  options,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  width?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-border/30 rounded-md px-3 py-2 text-[13px] outline-none appearance-none"
      style={{ width: width || '100%' }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function UploadBox({ label, id }: { label: string; id: string }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div>
      <label className="text-[11px] text-secondary block mb-1.5">{label}</label>
      <div
        className="border border-dashed border-border/40 rounded-md py-5 text-center text-secondary text-[12px] cursor-pointer hover:border-primary/30 transition-colors"
        onClick={() => document.getElementById(id)?.click()}
      >
        {fileName ? (
          <span className="text-primary">{fileName}</span>
        ) : (
          <>
            タップして撮影 / 選択
            <br />
            <span className="text-[11px] text-[#BDBDBD]">JPG, PNG（10MB以下）</span>
          </>
        )}
      </div>
      <input
        type="file"
        id={id}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setFileName(file.name);
        }}
      />
    </div>
  );
}

function SectionCard({
  title,
  required,
  description,
  children,
}: {
  title: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 mb-3">
      <div className="text-[14px] font-medium mb-3">
        {title}
        {required && <span className="text-red-600 ml-1">*</span>}
      </div>
      {description && (
        <div className="text-[11px] text-secondary mb-3">{description}</div>
      )}
      {children}
    </div>
  );
}

/* ---------- メインコンポーネント ---------- */

export default function OnboardingNewPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [form, setForm] = useState<OnboardFormState>(initialForm);

  const set = (key: keyof OnboardFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.lastName || !form.firstName || !form.birthDate || !form.address || !form.phone) {
      toast('必須項目を入力してください');
      return;
    }
    setLoading(true);
    try {
      await apiClient('/employees', {
        method: 'POST',
        body: JSON.stringify({
          lastName: form.lastName,
          firstName: form.firstName,
          lastNameKana: form.lastNameKana,
          firstNameKana: form.firstNameKana,
          birthDate: form.birthDate,
          gender: form.gender,
          address: form.address,
          phone: form.phone,
          email: form.email,
          bloodType: form.bloodType,
          emergencyContact: {
            name: form.emergencyName,
            relation: form.emergencyRelation,
            phone: form.emergencyPhone,
          },
          bankAccount: {
            bankName: form.bankName,
            branch: form.bankBranch,
            accountType: form.bankAccountType,
            accountNumber: form.bankAccountNumber,
          },
        }),
      });
      toast('入社情報を登録しました');
      setTimeout(() => router.push('/admin/onboarding'), 1000);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || '登録に失敗しました';
      toast(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 20 }}>
      {/* ページヘッダー */}
      <div className="text-center mb-6">
        <div className="text-[16px] font-medium">入社情報の登録</div>
        <div className="text-[12px] text-secondary mt-1">
          {form.lastName} {form.firstName} 様（2026年5月 入社予定）
        </div>
        <div className="text-[11px] text-secondary mt-0.5">
          以下の情報を入力・アップロードしてください
        </div>
      </div>

      {/* 基本情報 */}
      <SectionCard title="基本情報">
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <FormLabel required>姓</FormLabel>
            <FormInput value={form.lastName} readOnly />
          </div>
          <div>
            <FormLabel required>名</FormLabel>
            <FormInput value={form.firstName} readOnly />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <FormLabel>姓ふりがな</FormLabel>
            <FormInput value={form.lastNameKana} onChange={set('lastNameKana')} placeholder="はせがわ" />
          </div>
          <div>
            <FormLabel>名ふりがな</FormLabel>
            <FormInput value={form.firstNameKana} onChange={set('firstNameKana')} placeholder="つばさ" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <FormLabel required>生年月日</FormLabel>
            <FormInput type="date" value={form.birthDate} onChange={set('birthDate')} />
          </div>
          <div>
            <FormLabel>性別</FormLabel>
            <FormSelect value={form.gender} onChange={set('gender')} options={['男性', '女性', 'その他']} />
          </div>
        </div>
        <div className="mb-2">
          <FormLabel required>現住所</FormLabel>
          <FormInput
            value={form.address}
            onChange={set('address')}
            placeholder="〒530-0001 大阪府大阪市北区梅田1-1-1 〇〇マンション101"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <FormLabel required>電話番号</FormLabel>
            <FormInput value={form.phone} onChange={set('phone')} placeholder="090-1234-5678" />
          </div>
          <div>
            <FormLabel>メールアドレス</FormLabel>
            <FormInput type="email" value={form.email} onChange={set('email')} placeholder="tsubasa@example.com" />
          </div>
        </div>
        <div className="mt-2">
          <FormLabel>血液型</FormLabel>
          <FormSelect
            value={form.bloodType}
            onChange={set('bloodType')}
            options={['A型', 'B型', 'O型', 'AB型']}
            width="120px"
          />
        </div>
      </SectionCard>

      {/* 緊急連絡先 */}
      <SectionCard title="緊急連絡先" required>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FormLabel>氏名</FormLabel>
            <FormInput value={form.emergencyName} onChange={set('emergencyName')} placeholder="長谷川 太郎" />
          </div>
          <div>
            <FormLabel>続柄</FormLabel>
            <FormSelect
              value={form.emergencyRelation}
              onChange={set('emergencyRelation')}
              options={['父', '母', '配偶者', '兄弟姉妹', 'その他']}
            />
          </div>
          <div>
            <FormLabel>電話番号</FormLabel>
            <FormInput value={form.emergencyPhone} onChange={set('emergencyPhone')} placeholder="090-0000-0000" />
          </div>
        </div>
      </SectionCard>

      {/* 給与振込口座 */}
      <SectionCard title="給与振込口座" required>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <FormLabel>銀行名</FormLabel>
            <FormInput value={form.bankName} onChange={set('bankName')} placeholder="三菱UFJ銀行" />
          </div>
          <div>
            <FormLabel>支店名</FormLabel>
            <FormInput value={form.bankBranch} onChange={set('bankBranch')} placeholder="梅田支店" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FormLabel>口座種別</FormLabel>
            <FormSelect value={form.bankAccountType} onChange={set('bankAccountType')} options={['普通', '当座']} />
          </div>
          <div>
            <FormLabel>口座番号</FormLabel>
            <FormInput value={form.bankAccountNumber} onChange={set('bankAccountNumber')} placeholder="1234567" />
          </div>
        </div>
      </SectionCard>

      {/* 本人確認書類のアップロード */}
      <SectionCard
        title="本人確認書類のアップロード"
        required
        description="以下のいずれかをアップロードしてください。Google Driveに安全に保管されます。"
      >
        <div className="grid grid-cols-2 gap-3">
          <UploadBox label="運転免許証（表）" id="ob-upload-1" />
          <UploadBox label="運転免許証（裏）" id="ob-upload-2" />
        </div>
      </SectionCard>

      {/* マイナンバー */}
      <SectionCard
        title="マイナンバー"
        required
        description="マイナンバーカードまたは通知カードの写真をアップロードしてください"
      >
        <div className="grid grid-cols-2 gap-3">
          <UploadBox label="マイナンバーカード（表）" id="ob-upload-3" />
          <UploadBox label="マイナンバーカード（裏）" id="ob-upload-4" />
        </div>
      </SectionCard>

      {/* 年金手帳 */}
      <SectionCard
        title="年金手帳"
        description="基礎年金番号が記載されたページを撮影してください"
      >
        <div className="max-w-[50%]">
          <UploadBox label="" id="ob-upload-5" />
        </div>
      </SectionCard>

      {/* 健康診断結果 */}
      <SectionCard
        title="健康診断結果"
        description="直近3ヶ月以内の健康診断結果をアップロードしてください"
      >
        <div className="max-w-[50%]">
          <UploadBox label="" id="ob-upload-6" />
        </div>
      </SectionCard>

      {/* 注意書き */}
      <div className="card p-5 mb-3 bg-[#F7F7F5] border-none">
        <div className="text-[12px] text-secondary leading-[1.8]">
          <div className="font-medium text-primary mb-1">アップロードした書類について</div>
          アップロードされた画像はGoogle Driveの「入社書類 / {form.lastName} {form.firstName}」フォルダに自動保存されます。
          <br />
          テキスト情報（住所・口座等）は社員マスタに自動で取り込まれます。
          <br />
          入社予定社員一覧のチェック項目も自動で完了になります。
        </div>
      </div>

      {/* 送信ボタン・戻るボタン */}
      <div className="text-center py-4 pb-8 flex flex-col items-center gap-3">
        <button
          className="btn-primary text-[14px] py-3.5 px-14 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '送信中...' : '送信する'}
        </button>
        <button
          className="btn-outline text-sm py-2 px-6"
          onClick={() => router.push('/admin/onboarding')}
        >
          戻る
        </button>
      </div>

      <ToastUI />
    </div>
  );
}
