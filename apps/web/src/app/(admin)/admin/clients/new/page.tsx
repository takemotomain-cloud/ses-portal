/**
 * 管理側 新規クライアント登録フォーム
 *
 * HTMLプロトタイプ page-form-client を完全再現。
 * セクション: 基本情報 → 担当者情報 → 取引情報
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- フォーム型定義 ---------- */

interface ClientForm {
  companyName: string;
  displayName: string;
  industry: string;
  contactPerson: string;
  salesRep: string;
  email: string;
  phone: string;
  startDate: string;
  supplyChain: string;
  invoiceEmail: string;
}

const initialForm: ClientForm = {
  companyName: '',
  displayName: '',
  industry: '金融',
  contactPerson: '',
  salesRep: '山本 浩二',
  email: '',
  phone: '',
  startDate: '',
  supplyChain: 'エンド → 自社',
  invoiceEmail: '',
};

/* ---------- 共通フォーム部品 ---------- */

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-2xs text-secondary mb-1">
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
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-primary/40 transition-colors"
    />
  );
}

function FormSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none appearance-none focus:border-primary/40 transition-colors"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

/* ---------- メインコンポーネント ---------- */

export default function NewClientPage() {
  const router = useRouter();
  const { toast, ToastUI } = useToast();
  const [form, setForm] = useState<ClientForm>(initialForm);

  const set = <K extends keyof ClientForm>(key: K) => (value: ClientForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.companyName.trim()) {
      toast('会社名は必須です');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient('/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: form.companyName,
          industry: form.industry || undefined,
          contactPerson: form.contactPerson || undefined,
          contactEmail: form.email || undefined,
          contactPhone: form.phone || undefined,
          tradeFlow: form.supplyChain || undefined,
          billingEmail: form.invoiceEmail || undefined,
          tradeStartDate: form.startDate || undefined,
        }),
      });
      toast('登録しました');
      router.push('/admin/clients');
    } catch (err: any) {
      toast(err?.message || 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">新規クライアント登録</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/admin/clients')} className="btn-outline text-sm py-2">
            キャンセル
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm py-2 disabled:opacity-50">
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* 基本情報 */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">基本情報</div>

          {/* 会社名（正式名称）— full width */}
          <div className="mb-2">
            <FormLabel required>会社名（正式名称）</FormLabel>
            <FormInput
              value={form.companyName}
              onChange={set('companyName')}
              placeholder="株式会社〇〇"
            />
          </div>

          {/* 表示名 / 業種 — 2col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>表示名（略称）</FormLabel>
              <FormInput
                value={form.displayName}
                onChange={set('displayName')}
                placeholder="〇〇社"
              />
            </div>
            <div>
              <FormLabel>業種</FormLabel>
              <FormSelect
                value={form.industry}
                onChange={set('industry')}
                options={['金融', '通信', '製造', '小売', '保険', '物流', '不動産', '医療', '教育', 'その他']}
              />
            </div>
          </div>
        </div>

        {/* 担当者情報 */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">担当者情報</div>

          {/* 先方担当者名 / 担当営業 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>先方担当者名</FormLabel>
              <FormInput
                value={form.contactPerson}
                onChange={set('contactPerson')}
                placeholder="鶴田 部長"
              />
            </div>
            <div>
              <FormLabel>担当営業</FormLabel>
              <FormSelect
                value={form.salesRep}
                onChange={set('salesRep')}
                options={['山本 浩二', '田辺 恵子']}
              />
            </div>
          </div>

          {/* 連絡先メール / 電話番号 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>連絡先メール</FormLabel>
              <FormInput
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="tanaka@example.co.jp"
              />
            </div>
            <div>
              <FormLabel>電話番号</FormLabel>
              <FormInput
                value={form.phone}
                onChange={set('phone')}
                placeholder="03-1234-5678"
              />
            </div>
          </div>
        </div>

        {/* 取引情報 */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">取引情報</div>

          {/* 取引開始日 / 商流 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>取引開始日</FormLabel>
              <FormInput
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
              />
            </div>
            <div>
              <FormLabel>商流</FormLabel>
              <FormSelect
                value={form.supplyChain}
                onChange={set('supplyChain')}
                options={['エンド → 自社', 'エンド → 1社 → 自社', 'エンド → 2社 → 自社']}
              />
            </div>
          </div>

          {/* 請求書送付先メール — full width */}
          <div>
            <FormLabel>請求書送付先メール</FormLabel>
            <FormInput
              type="email"
              value={form.invoiceEmail}
              onChange={set('invoiceEmail')}
              placeholder="keiri@example.co.jp"
            />
          </div>
        </div>
      </div>

      {/* 戻るボタン */}
      <div className="mt-5">
        <button onClick={() => router.back()} className="btn-outline text-sm py-2">
          戻る
        </button>
      </div>

      <ToastUI />
    </div>
  );
}
