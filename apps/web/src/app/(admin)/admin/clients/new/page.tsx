/**
 * 管理側 新規クライアント登録フォーム
 *
 * セクション: 基本情報 → 担当者情報 → 取引情報
 * gBizINFO連携: 会社名入力で企業情報を自動取得
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  salesRep: string;
  email: string;
  phone: string;
  startDate: string;
  invoiceEmail: string;
}

const initialForm: ClientForm = {
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
  salesRep: '',
  email: '',
  phone: '',
  startDate: '',
  invoiceEmail: '',
};

/* ---------- gBizINFO検索結果 ---------- */

interface GBizResult {
  corporateNumber: string;
  name: string;
  kana: string;
  location: string;
  postalCode: string;
  representativeName: string;
  capitalStock: string;
  companyUrl: string;
  employeeNumber: string;
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

/* ---------- 資本金フォーマット ---------- */

function formatCapital(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) return value;
  if (num >= 100000000) return `${(num / 100000000).toLocaleString()}億円`;
  if (num >= 10000) return `${(num / 10000).toLocaleString()}万円`;
  return `${num.toLocaleString()}円`;
}

/* ---------- メインコンポーネント ---------- */

export default function NewClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, ToastUI } = useToast();
  const [form, setForm] = useState<ClientForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  /* 商談ログからの自動入力 */
  useEffect(() => {
    if (searchParams.get('from') === 'deal') {
      setForm(prev => ({
        ...prev,
        companyName: searchParams.get('company') || prev.companyName,
        email: searchParams.get('email') || prev.email,
        phone: searchParams.get('phone') || prev.phone,
        address: searchParams.get('address') || prev.address,
        contactPerson: searchParams.get('contactPerson') || prev.contactPerson,
      }));
    }
  }, [searchParams]);

  /* gBizINFO検索 */
  const [gbizResults, setGbizResults] = useState<GBizResult[]>([]);
  const [gbizSearching, setGbizSearching] = useState(false);
  const [showGbizDropdown, setShowGbizDropdown] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function update(field: keyof ClientForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* 会社名入力でgBizINFO検索（デバウンス） */
  const handleCompanyNameChange = useCallback((value: string) => {
    update('companyName', value);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (value.trim().length < 2) {
      setGbizResults([]);
      setShowGbizDropdown(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setGbizSearching(true);
      try {
        const results = await apiClient<GBizResult[]>(`/clients/gbiz/search?name=${encodeURIComponent(value.trim())}`);
        setGbizResults(results || []);
        setShowGbizDropdown(results && results.length > 0);
      } catch {
        setGbizResults([]);
        setShowGbizDropdown(false);
      } finally {
        setGbizSearching(false);
      }
    }, 500);
  }, []);

  /* gBizINFO結果を選択してフォームに反映 */
  const applyGbizResult = (r: GBizResult) => {
    setForm((prev) => ({
      ...prev,
      companyName: r.name || prev.companyName,
      corporateNumber: r.corporateNumber || prev.corporateNumber,
      invoiceNumber: r.corporateNumber ? `T${r.corporateNumber}` : prev.invoiceNumber,
      postalCode: r.postalCode || prev.postalCode,
      address: r.location || prev.address,
      representName: r.representativeName || prev.representName,
      capital: r.capitalStock ? formatCapital(r.capitalStock) : prev.capital,
      websiteUrl: r.companyUrl || prev.websiteUrl,
    }));
    setShowGbizDropdown(false);
    toast('gBizINFOから企業情報を取得しました');
  };

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

          {/* 会社名 + gBizINFO検索 */}
          <div className="mb-2 relative" ref={dropdownRef}>
            <FormLabel required>会社名（正式名称）</FormLabel>
            <div className="relative">
              <input
                type="text"
                className={inputCls}
                value={form.companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                onFocus={() => { if (gbizResults.length > 0) setShowGbizDropdown(true); }}
                placeholder="株式会社〇〇（2文字以上でgBizINFO検索）"
              />
              {gbizSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">検索中...</span>
              )}
            </div>

            {/* gBizINFO候補ドロップダウン */}
            {showGbizDropdown && gbizResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                <div className="px-3 py-2 text-2xs text-secondary border-b border-border/30 bg-page/50">
                  gBizINFO検索結果（{gbizResults.length}件） - クリックで自動入力
                </div>
                {gbizResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-page/80 transition-colors border-b border-border/10 last:border-b-0"
                    onClick={() => applyGbizResult(r)}
                  >
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {r.location && <span className="text-2xs text-secondary">{r.location}</span>}
                      {r.representativeName && <span className="text-2xs text-secondary">代表: {r.representativeName}</span>}
                      {r.corporateNumber && <span className="text-2xs text-secondary">法人番号: {r.corporateNumber}</span>}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full text-center px-3 py-2 text-xs text-secondary hover:bg-page/80"
                  onClick={() => setShowGbizDropdown(false)}
                >
                  閉じる
                </button>
              </div>
            )}
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
                placeholder="鶴田 部長"
              />
            </div>
            <div>
              <FormLabel>担当営業</FormLabel>
              <input
                type="text"
                className={inputCls}
                value={form.salesRep}
                onChange={(e) => update('salesRep', e.target.value)}
                placeholder=""
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
            <div>
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

      <div className="mt-5">
        <button onClick={() => router.back()} className="btn-outline text-sm py-2">
          戻る
        </button>
      </div>

      <ToastUI />
    </div>
  );
}
