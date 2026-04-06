/**
 * 管理側 クライアント編集ページ
 *
 * GET /api/clients/:id で既存データを取得し、フォームに表示。
 * PATCH /api/clients/:id で更新。
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

/* ---------- フォーム型定義 ---------- */

interface ClientForm {
  companyName: string;
  corporateNumber: string;
  invoiceNumber: string;
  postalCode: string;
  address: string;
  representName: string;
  establishedDate: string;
  capital: string;
  websiteUrl: string;
  contactPerson: string;
  email: string;
  phone: string;
  startDate: string;
  invoiceEmail: string;
}

/* ---------- 共通フォーム部品 ---------- */

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-2xs text-secondary mb-1">
      {children}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );
}

const inputCls =
  'w-full border border-border/30 rounded-md px-3 py-2 text-sm outline-none focus:border-primary/40 transition-colors';

/* ---------- メインコンポーネント ---------- */

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const { toast, ToastUI } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ClientForm>({
    companyName: '',
    corporateNumber: '',
    invoiceNumber: '',
    postalCode: '',
    address: '',
    representName: '',
    establishedDate: '',
    capital: '',
    websiteUrl: '',
    contactPerson: '',
    email: '',
    phone: '',
    startDate: '',
    invoiceEmail: '',
  });

  useEffect(() => {
    apiClient<any>(`/clients/${clientId}`)
      .then((data) => {
        setForm({
          companyName: data.name || '',
          corporateNumber: data.corporateNumber || '',
          invoiceNumber: data.invoiceNumber || '',
          postalCode: data.postalCode || '',
          address: data.address || '',
          representName: data.representName || '',
          establishedDate: data.establishedDate || '',
          capital: data.capital || '',
          websiteUrl: data.websiteUrl || '',
          contactPerson: data.contactPerson || '',
          email: data.contactEmail || '',
          phone: data.contactPhone || '',
          startDate: data.tradeStartDate
            ? new Date(data.tradeStartDate).toISOString().split('T')[0]
            : '',
          invoiceEmail: data.billingEmail || '',
        });
      })
      .catch((err: any) => {
        toast(err?.message || 'クライアント情報の取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, [clientId, toast]);

  function update(field: keyof ClientForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.companyName.trim()) {
      toast('会社名は必須です');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient(`/clients/${clientId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.companyName,
          corporateNumber: form.corporateNumber || undefined,
          invoiceNumber: form.invoiceNumber || undefined,
          postalCode: form.postalCode || undefined,
          address: form.address || undefined,
          representName: form.representName || undefined,
          establishedDate: form.establishedDate || undefined,
          capital: form.capital || undefined,
          websiteUrl: form.websiteUrl || undefined,
          contactPerson: form.contactPerson || undefined,
          contactEmail: form.email || undefined,
          contactPhone: form.phone || undefined,
          billingEmail: form.invoiceEmail || undefined,
          tradeStartDate: form.startDate || undefined,
        }),
      });
      toast('更新しました');
      router.push('/admin/clients');
    } catch (err: any) {
      toast(err?.message || 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-secondary">読み込み中...</div>
    );
  }

  return (
    <div>
      {/* ページヘッダー */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h1 className="text-2xl font-medium">クライアント編集</h1>
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

          <div className="mb-2">
            <FormLabel required>会社名（正式名称）</FormLabel>
            <input
              type="text"
              className={inputCls}
              value={form.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              placeholder="株式会社〇〇"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>法人番号</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.corporateNumber}
                onChange={(e) => update('corporateNumber', e.target.value)}
                placeholder="1234567890123"
              />
            </div>
            <div>
              <FormLabel>インボイス番号（T番号）</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.invoiceNumber}
                onChange={(e) => update('invoiceNumber', e.target.value)}
                placeholder="T1234567890123"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>郵便番号</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.postalCode}
                onChange={(e) => update('postalCode', e.target.value)}
                placeholder="100-0001"
              />
            </div>
            <div>
              <FormLabel>代表者名</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.representName}
                onChange={(e) => update('representName', e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
          </div>

          <div className="mb-2">
            <FormLabel>本社所在地</FormLabel>
            <input
              type="text"
              className={inputCls}
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="東京都千代田区丸の内1-1-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>設立年月</FormLabel>
              <input
                type="month"
                className={inputCls}
                value={form.establishedDate}
                onChange={(e) => update('establishedDate', e.target.value)}
              />
            </div>
            <div>
              <FormLabel>資本金</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.capital}
                onChange={(e) => update('capital', e.target.value)}
                placeholder="1,000万円"
              />
            </div>
          </div>

          <div>
            <FormLabel>コーポレートサイトURL</FormLabel>
            <input
              type="url"
              className={inputCls}
              value={form.websiteUrl}
              onChange={(e) => update('websiteUrl', e.target.value)}
              placeholder="https://example.co.jp"
            />
          </div>
        </div>

        {/* 担当者情報 */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">担当者情報</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <FormLabel>先方担当者名</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.contactPerson}
                onChange={(e) => update('contactPerson', e.target.value)}
                placeholder="田中一郎"
              />
            </div>
            <div>
              <FormLabel>連絡先メール</FormLabel>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="tanaka@example.co.jp"
              />
            </div>
          </div>

          <div className="mb-2">
            <FormLabel>電話番号</FormLabel>
            <input
              type="text"
              className={inputCls}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="03-1234-5678"
            />
          </div>
        </div>

        {/* 取引情報 */}
        <div className="card p-5 mb-3">
          <div className="text-sm font-medium mb-3">取引情報</div>

          <div className="mb-2">
            <FormLabel>取引開始日</FormLabel>
            <input
              type="date"
              className={inputCls}
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </div>

          <div>
            <FormLabel>請求書送付先メール</FormLabel>
            <input
              type="email"
              className={inputCls}
              value={form.invoiceEmail}
              onChange={(e) => update('invoiceEmail', e.target.value)}
              placeholder="keiri@example.co.jp"
            />
          </div>
        </div>
      </div>

      <ToastUI />
    </div>
  );
}
