import {
  computeClosingDate,
  computeDueDate,
  resolvePaymentTerm,
  ResolvedPaymentTerm,
  addMonths,
  lastDayOfMonth,
  shiftToPrevBusinessDay,
} from './payment-terms.util';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('payment-terms util', () => {
  describe('lastDayOfMonth', () => {
    it('閏年 Feb', () => {
      expect(fmt(lastDayOfMonth(2024, 2))).toBe('2024-02-29');
    });
    it('非閏年 Feb', () => {
      expect(fmt(lastDayOfMonth(2025, 2))).toBe('2025-02-28');
    });
    it('Apr', () => {
      expect(fmt(lastDayOfMonth(2026, 4))).toBe('2026-04-30');
    });
  });

  describe('addMonths', () => {
    it('rolls month and clamps to end of month', () => {
      const d = new Date(2026, 0, 31); // 2026-01-31
      expect(fmt(addMonths(d, 1))).toBe('2026-02-28');
    });
  });

  describe('computeClosingDate', () => {
    it('closingDay=0 → EOM', () => {
      expect(fmt(computeClosingDate('2026-04', 0))).toBe('2026-04-30');
    });
    it('closingDay=20 → 20th', () => {
      expect(fmt(computeClosingDate('2026-04', 20))).toBe('2026-04-20');
    });
    it('clamps to EOM', () => {
      expect(fmt(computeClosingDate('2026-02', 31))).toBe('2026-02-28');
    });
  });

  describe('computeDueDate', () => {
    const eomNextEom: ResolvedPaymentTerm = {
      closingDay: 0,
      paymentMode: 'NEXT_MONTH_EOM',
      paymentMonths: 1,
      paymentDay: null,
      paymentDays: null,
      bankHolidayAdj: 'PREV_BUSINESS_DAY',
    };

    it('月末締め翌月末払い: 2026-04分 → 2026-05-29 (5/31 日曜, 5/30 土曜)', () => {
      expect(fmt(computeDueDate('2026-04', eomNextEom))).toBe('2026-05-29');
    });

    it('月末締め翌月末払い: 2026-03分 → 2026-04-30 (Thu)', () => {
      expect(fmt(computeDueDate('2026-03', eomNextEom))).toBe('2026-04-30');
    });

    it('月末締め45日サイト: 2026-04-30 + 45 = 2026-06-14 (Sun) → 2026-06-12 (Fri)', () => {
      const term: ResolvedPaymentTerm = {
        closingDay: 0,
        paymentMode: 'DAYS',
        paymentMonths: null,
        paymentDay: null,
        paymentDays: 45,
        bankHolidayAdj: 'PREV_BUSINESS_DAY',
      };
      expect(fmt(computeDueDate('2026-04', term))).toBe('2026-06-12');
    });

    it('20日締め翌月10日払い: 2026-04-20 → 2026-05-10 (Sun) → 2026-05-08 (Fri)', () => {
      const term: ResolvedPaymentTerm = {
        closingDay: 20,
        paymentMode: 'NTH_MONTH_DAY',
        paymentMonths: 1,
        paymentDay: 10,
        paymentDays: null,
        bankHolidayAdj: 'PREV_BUSINESS_DAY',
      };
      expect(fmt(computeDueDate('2026-04', term))).toBe('2026-05-08');
    });

    it('bankHolidayAdj=NONE では繰り上げない', () => {
      const term: ResolvedPaymentTerm = { ...eomNextEom, bankHolidayAdj: 'NONE' };
      expect(fmt(computeDueDate('2026-04', term))).toBe('2026-05-31');
    });
  });

  describe('resolvePaymentTerm', () => {
    const client = {
      closingDay: 0,
      paymentMode: 'NEXT_MONTH_EOM',
      paymentMonths: 1,
      paymentDay: null,
      paymentDays: null,
      bankHolidayAdj: 'PREV_BUSINESS_DAY',
    };
    it('project が設定済みなら project', () => {
      const project = {
        closingDay: 20,
        paymentMode: 'NTH_MONTH_DAY',
        paymentMonths: 1,
        paymentDay: 10,
        paymentDays: null,
        bankHolidayAdj: null,
      };
      const r = resolvePaymentTerm(project, client);
      expect(r?.closingDay).toBe(20);
      expect(r?.paymentMode).toBe('NTH_MONTH_DAY');
    });
    it('project が null なら client', () => {
      const r = resolvePaymentTerm(null, client);
      expect(r?.closingDay).toBe(0);
      expect(r?.paymentMode).toBe('NEXT_MONTH_EOM');
    });
    it('project の closingDay/paymentMode が欠ければ client', () => {
      const project = {
        closingDay: 20,
        paymentMode: null,
        paymentMonths: null,
        paymentDay: null,
        paymentDays: null,
        bankHolidayAdj: null,
      };
      const r = resolvePaymentTerm(project, client);
      expect(r?.paymentMode).toBe('NEXT_MONTH_EOM');
    });
    it('両方未設定なら null', () => {
      expect(resolvePaymentTerm(null, null)).toBeNull();
    });
  });

  describe('shiftToPrevBusinessDay', () => {
    it('日曜 → 金曜', () => {
      expect(fmt(shiftToPrevBusinessDay(new Date(2026, 4, 31)))).toBe('2026-05-29');
    });
    it('平日ならそのまま', () => {
      expect(fmt(shiftToPrevBusinessDay(new Date(2026, 3, 30)))).toBe('2026-04-30');
    });
  });
});
