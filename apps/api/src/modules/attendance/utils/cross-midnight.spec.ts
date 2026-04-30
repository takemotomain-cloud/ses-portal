import { buildClockTimes, isCrossMidnight } from './cross-midnight';

const fmtLocal = (d?: Date) => {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

describe('cross-midnight', () => {
  describe('isCrossMidnight', () => {
    it('19:00 / 02:00 → true', () => {
      expect(isCrossMidnight('19:00', '02:00')).toBe(true);
    });
    it('23:00 / 03:00 → true', () => {
      expect(isCrossMidnight('23:00', '03:00')).toBe(true);
    });
    it('09:00 / 18:00 → false', () => {
      expect(isCrossMidnight('09:00', '18:00')).toBe(false);
    });
    it('09:00 / 09:00 → false (同時刻)', () => {
      expect(isCrossMidnight('09:00', '09:00')).toBe(false);
    });
    it('空文字 → false', () => {
      expect(isCrossMidnight('', '02:00')).toBe(false);
      expect(isCrossMidnight('19:00', '')).toBe(false);
    });
  });

  describe('buildClockTimes', () => {
    it('日跨ぎ: 19:00 / 02:00 → clockOut が翌日', () => {
      const r = buildClockTimes('2026-04-30', '19:00', '02:00');
      expect(fmtLocal(r.clockIn)).toBe('2026-04-30T19:00');
      expect(fmtLocal(r.clockOut)).toBe('2026-05-01T02:00');
      expect(r.crossMidnight).toBe(true);
    });

    it('同日: 09:00 / 18:00', () => {
      const r = buildClockTimes('2026-04-30', '09:00', '18:00');
      expect(fmtLocal(r.clockIn)).toBe('2026-04-30T09:00');
      expect(fmtLocal(r.clockOut)).toBe('2026-04-30T18:00');
      expect(r.crossMidnight).toBe(false);
    });

    it('深夜開始: 23:00 / 03:00', () => {
      const r = buildClockTimes('2026-04-30', '23:00', '03:00');
      expect(fmtLocal(r.clockIn)).toBe('2026-04-30T23:00');
      expect(fmtLocal(r.clockOut)).toBe('2026-05-01T03:00');
      expect(r.crossMidnight).toBe(true);
    });

    it('月跨ぎ: 4/30 19:00 / 02:00 → 5/1', () => {
      const r = buildClockTimes('2026-04-30', '19:00', '02:00');
      expect(fmtLocal(r.clockOut)).toBe('2026-05-01T02:00');
    });

    it('年跨ぎ: 12/31 23:00 / 01:00 → 翌年 1/1', () => {
      const r = buildClockTimes('2025-12-31', '23:00', '01:00');
      expect(fmtLocal(r.clockOut)).toBe('2026-01-01T01:00');
    });

    it('clockOut のみ未指定', () => {
      const r = buildClockTimes('2026-04-30', '19:00', undefined);
      expect(fmtLocal(r.clockIn)).toBe('2026-04-30T19:00');
      expect(r.clockOut).toBeUndefined();
      expect(r.crossMidnight).toBe(false);
    });

    it('両方未指定', () => {
      const r = buildClockTimes('2026-04-30', undefined, undefined);
      expect(r.clockIn).toBeUndefined();
      expect(r.clockOut).toBeUndefined();
      expect(r.crossMidnight).toBe(false);
    });

    it('clockIn のみ未指定: clockOut は workDate と同日 (補正なし)', () => {
      const r = buildClockTimes('2026-04-30', undefined, '18:00');
      expect(r.clockIn).toBeUndefined();
      expect(fmtLocal(r.clockOut)).toBe('2026-04-30T18:00');
      expect(r.crossMidnight).toBe(false);
    });
  });
});
