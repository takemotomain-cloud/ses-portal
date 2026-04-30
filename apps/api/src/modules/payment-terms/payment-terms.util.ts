/**
 * PaymentTerms ユーティリティ
 *
 * クライアント／案件の支払条件から、請求対象月に対する dueDate（支払期日）を計算する。
 *
 * - resolvePaymentTerm: Project が設定済みなら Project、そうでなければ Client の既定。両方未設定なら null
 * - computeDueDate    : 支払期日を計算（土日祝は前営業日に繰り上げ）
 */

import * as holidayJp from '@holiday-jp/holiday_jp';

export type PaymentMode = 'NEXT_MONTH_EOM' | 'NTH_MONTH_DAY' | 'DAYS';

export interface PaymentTermInput {
  closingDay: number | null | undefined;       // 0 = 月末, 1-31 = 該当日
  paymentMode: string | null | undefined;
  paymentMonths: number | null | undefined;
  paymentDay: number | null | undefined;        // 0 = 月末, 1-31 = 該当日
  paymentDays: number | null | undefined;
  bankHolidayAdj: string | null | undefined;
}

export interface ResolvedPaymentTerm {
  closingDay: number;
  paymentMode: PaymentMode;
  paymentMonths: number | null;
  paymentDay: number | null;
  paymentDays: number | null;
  bankHolidayAdj: 'PREV_BUSINESS_DAY' | 'NONE';
}

/** Project が設定済みなら Project、そうでなければ Client の既定を返す。両方未設定なら null。 */
export function resolvePaymentTerm(
  project: PaymentTermInput | null | undefined,
  client: PaymentTermInput | null | undefined,
): ResolvedPaymentTerm | null {
  const src = isConfigured(project) ? project : isConfigured(client) ? client : null;
  if (!src) return null;
  return {
    closingDay: src.closingDay ?? 0,
    paymentMode: (src.paymentMode as PaymentMode) ?? 'NEXT_MONTH_EOM',
    paymentMonths: src.paymentMonths ?? null,
    paymentDay: src.paymentDay ?? null,
    paymentDays: src.paymentDays ?? null,
    bankHolidayAdj:
      (src.bankHolidayAdj as 'PREV_BUSINESS_DAY' | 'NONE') ?? 'PREV_BUSINESS_DAY',
  };
}

function isConfigured(t: PaymentTermInput | null | undefined): t is PaymentTermInput {
  return !!t && t.closingDay != null && !!t.paymentMode;
}

/**
 * 請求対象月の締め日を返す。
 * closingDay = 0 → 月末
 * closingDay = N (1-31) → 該当日（月末を超える場合は月末に丸め）
 */
export function computeClosingDate(targetMonth: string, closingDay: number): Date {
  // 'YYYY-MM'
  const [yStr, mStr] = targetMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10); // 1-12
  if (!closingDay || closingDay === 0) return lastDayOfMonth(y, m);
  const lastDay = lastDayOfMonth(y, m).getDate();
  const d = Math.min(closingDay, lastDay);
  return new Date(y, m - 1, d);
}

/**
 * 締め日を起点に支払期日を計算。
 */
export function computeDueDate(targetMonth: string, term: ResolvedPaymentTerm): Date {
  const closing = computeClosingDate(targetMonth, term.closingDay);
  let payDate: Date;

  switch (term.paymentMode) {
    case 'NEXT_MONTH_EOM': {
      const n = term.paymentMonths ?? 1;
      const shifted = addMonths(closing, n);
      payDate = lastDayOfMonth(shifted.getFullYear(), shifted.getMonth() + 1);
      break;
    }
    case 'NTH_MONTH_DAY': {
      const n = term.paymentMonths ?? 1;
      const shifted = addMonths(closing, n);
      const day = term.paymentDay ?? 0;
      if (!day || day === 0) {
        payDate = lastDayOfMonth(shifted.getFullYear(), shifted.getMonth() + 1);
      } else {
        const lastDay = lastDayOfMonth(shifted.getFullYear(), shifted.getMonth() + 1).getDate();
        payDate = new Date(shifted.getFullYear(), shifted.getMonth(), Math.min(day, lastDay));
      }
      break;
    }
    case 'DAYS': {
      const d = term.paymentDays ?? 0;
      payDate = new Date(closing);
      payDate.setDate(payDate.getDate() + d);
      break;
    }
    default:
      payDate = closing;
  }

  if (term.bankHolidayAdj === 'PREV_BUSINESS_DAY') {
    payDate = shiftToPrevBusinessDay(payDate);
  }
  return payDate;
}

/** 指定月の末日（Date） */
export function lastDayOfMonth(year: number, month1to12: number): Date {
  return new Date(year, month1to12, 0);
}

/** 月数を加算（末日調整あり） */
export function addMonths(date: Date, months: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const d = date.getDate();
  const target = new Date(y, m, 1);
  const lastDay = lastDayOfMonth(target.getFullYear(), target.getMonth() + 1).getDate();
  target.setDate(Math.min(d, lastDay));
  return target;
}

/** 土日祝なら前営業日に繰り上げ */
export function shiftToPrevBusinessDay(date: Date): Date {
  const d = new Date(date);
  while (isNonBusinessDay(d)) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function isNonBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;
  return holidayJp.isHoliday(date);
}

/** プリセット定義（UI/バックエンド共通で使う想定） */
export const PAYMENT_TERM_PRESETS = [
  { key: 'EOM_NEXT_EOM',       label: '月末締め翌月末払い',     closingDay: 0,  paymentMode: 'NEXT_MONTH_EOM' as const, paymentMonths: 1 },
  { key: 'EOM_NEXT_NEXT_EOM',  label: '月末締め翌々月末払い',   closingDay: 0,  paymentMode: 'NEXT_MONTH_EOM' as const, paymentMonths: 2 },
  { key: 'EOM_DAYS_45',        label: '月末締め45日サイト',     closingDay: 0,  paymentMode: 'DAYS' as const,           paymentDays: 45 },
  { key: 'EOM_DAYS_60',        label: '月末締め60日サイト',     closingDay: 0,  paymentMode: 'DAYS' as const,           paymentDays: 60 },
  { key: 'D20_NEXT_D10',       label: '20日締め翌月10日払い',   closingDay: 20, paymentMode: 'NTH_MONTH_DAY' as const,  paymentMonths: 1, paymentDay: 10 },
];
