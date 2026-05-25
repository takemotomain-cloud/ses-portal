'use client';

/**
 * PaymentTermEditor
 *
 * 支払サイクル（締め日 + 支払モード + 月数 + 日 + 日数 + 銀行休業日対応）を編集する共通フォーム。
 * クライアント編集 / 案件編集 の両方で再利用する。
 *
 * 値は「親が状態管理する controlled component」設計。各 onChange を親で受け取って state に流し込む。
 */

import { useMemo } from 'react';

export interface PaymentTermValue {
  closingDay: number | null;
  paymentMode: string | null; // 'NEXT_MONTH_EOM' | 'NTH_MONTH_DAY' | 'DAYS' | null
  paymentMonths: number | null;
  paymentDay: number | null;
  paymentDays: number | null;
  bankHolidayAdj: string | null; // 'PREV_BUSINESS_DAY' | 'NONE' | null
}

export const EMPTY_PAYMENT_TERM: PaymentTermValue = {
  closingDay: null,
  paymentMode: null,
  paymentMonths: null,
  paymentDay: null,
  paymentDays: null,
  bankHolidayAdj: null,
};

interface Preset {
  key: string;
  label: string;
  value: PaymentTermValue;
}

const PRESETS: Preset[] = [
  {
    key: 'EOM_NEXT_EOM',
    label: '月末締め翌月末払い',
    value: { closingDay: 0, paymentMode: 'NEXT_MONTH_EOM', paymentMonths: 1, paymentDay: null, paymentDays: null, bankHolidayAdj: 'PREV_BUSINESS_DAY' },
  },
  {
    key: 'EOM_NEXT_NEXT_EOM',
    label: '月末締め翌々月末払い',
    value: { closingDay: 0, paymentMode: 'NEXT_MONTH_EOM', paymentMonths: 2, paymentDay: null, paymentDays: null, bankHolidayAdj: 'PREV_BUSINESS_DAY' },
  },
  {
    key: 'EOM_DAYS_45',
    label: '月末締め45日サイト',
    value: { closingDay: 0, paymentMode: 'DAYS', paymentMonths: null, paymentDay: null, paymentDays: 45, bankHolidayAdj: 'PREV_BUSINESS_DAY' },
  },
  {
    key: 'EOM_DAYS_60',
    label: '月末締め60日サイト',
    value: { closingDay: 0, paymentMode: 'DAYS', paymentMonths: null, paymentDay: null, paymentDays: 60, bankHolidayAdj: 'PREV_BUSINESS_DAY' },
  },
  {
    key: 'D20_NEXT_D10',
    label: '20日締め翌月10日払い',
    value: { closingDay: 20, paymentMode: 'NTH_MONTH_DAY', paymentMonths: 1, paymentDay: 10, paymentDays: null, bankHolidayAdj: 'PREV_BUSINESS_DAY' },
  },
];

const CLOSING_DAY_OPTIONS = [
  { value: 0, label: '月末' },
  { value: 10, label: '10 日' },
  { value: 15, label: '15 日' },
  { value: 20, label: '20 日' },
  { value: 25, label: '25 日' },
];

interface Props {
  value: PaymentTermValue;
  onChange: (next: PaymentTermValue) => void;
  /** disabled = フォーム全体を非活性化（「クライアント既定を使う」ON 時など） */
  disabled?: boolean;
}

function valuesEqual(a: PaymentTermValue, b: PaymentTermValue): boolean {
  return (
    a.closingDay === b.closingDay &&
    a.paymentMode === b.paymentMode &&
    a.paymentMonths === b.paymentMonths &&
    a.paymentDay === b.paymentDay &&
    a.paymentDays === b.paymentDays &&
    a.bankHolidayAdj === b.bankHolidayAdj
  );
}

export function PaymentTermEditor({ value, onChange, disabled = false }: Props) {
  const matchedPreset = useMemo(() => {
    return PRESETS.find((p) => valuesEqual(p.value, value))?.key ?? 'CUSTOM';
  }, [value]);

  function applyPreset(key: string) {
    const p = PRESETS.find((pr) => pr.key === key);
    if (p) onChange(p.value);
  }

  const inputCls = 'w-full border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30 disabled:bg-page disabled:text-secondary';

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div className="mb-3">
        <label className="block text-2xs text-secondary mb-1">プリセット</label>
        <select
          value={matchedPreset}
          onChange={(e) => {
            if (e.target.value === 'CUSTOM') return;
            applyPreset(e.target.value);
          }}
          className={inputCls}
          disabled={disabled}
        >
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value="CUSTOM">カスタム</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <label className="block text-2xs text-secondary mb-1">締め日</label>
          <select
            value={value.closingDay ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
              onChange({ ...value, closingDay: v });
            }}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">--</option>
            {CLOSING_DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-2xs text-secondary mb-1">支払モード</label>
          <select
            value={value.paymentMode ?? ''}
            onChange={(e) => onChange({ ...value, paymentMode: e.target.value || null })}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">--</option>
            <option value="NEXT_MONTH_EOM">N か月後の月末</option>
            <option value="NTH_MONTH_DAY">N か月後の指定日</option>
            <option value="DAYS">締めから N 日後</option>
          </select>
        </div>
      </div>

      {value.paymentMode === 'NEXT_MONTH_EOM' && (
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-2xs text-secondary mb-1">月数</label>
            <input
              type="number"
              min={1}
              max={6}
              value={value.paymentMonths ?? 1}
              onChange={(e) => onChange({ ...value, paymentMonths: e.target.value ? parseInt(e.target.value, 10) : null })}
              className={inputCls}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {value.paymentMode === 'NTH_MONTH_DAY' && (
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-2xs text-secondary mb-1">月数</label>
            <input
              type="number"
              min={1}
              max={6}
              value={value.paymentMonths ?? 1}
              onChange={(e) => onChange({ ...value, paymentMonths: e.target.value ? parseInt(e.target.value, 10) : null })}
              className={inputCls}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-2xs text-secondary mb-1">支払日 (0 = 月末)</label>
            <input
              type="number"
              min={0}
              max={31}
              value={value.paymentDay ?? ''}
              onChange={(e) => onChange({ ...value, paymentDay: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              className={inputCls}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {value.paymentMode === 'DAYS' && (
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-2xs text-secondary mb-1">締めからの日数</label>
            <input
              type="number"
              min={1}
              max={180}
              value={value.paymentDays ?? ''}
              onChange={(e) => onChange({ ...value, paymentDays: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              className={inputCls}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-2xs text-secondary mb-1">銀行休業日対応</label>
        <select
          value={value.bankHolidayAdj ?? 'PREV_BUSINESS_DAY'}
          onChange={(e) => onChange({ ...value, bankHolidayAdj: e.target.value })}
          className={inputCls}
          disabled={disabled}
        >
          <option value="PREV_BUSINESS_DAY">前営業日に繰り上げ</option>
          <option value="NONE">そのまま</option>
        </select>
      </div>
    </div>
  );
}
