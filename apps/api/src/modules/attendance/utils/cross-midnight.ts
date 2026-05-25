/**
 * 日跨ぎ勤務の clockIn / clockOut 補正ユーティリティ
 *
 * SES 現場では「19:00 出勤 → 翌 02:00 退勤」のような深夜残業が頻発する。
 * 単純に workDate + HH:MM で組み立てると clockOut < clockIn になり時間計算が破綻するため、
 * 退勤時刻が出勤時刻より早い場合は退勤側を翌日扱いに補正する。
 *
 * 例:
 *   workDate=2026-04-30, in=19:00, out=02:00
 *     → clockIn  = 2026-04-30T19:00 (workDate と同日)
 *     → clockOut = 2026-05-01T02:00 (翌日に補正)
 *
 * 同日扱いが正しい場合 (in=09:00 out=18:00) はそのまま同日。
 */

/**
 * workDate (YYYY-MM-DD) + 'HH:MM' から Date を作る。
 * day オフセットがあれば +N 日する。
 */
function buildLocalDate(workDate: string, hhmm: string, dayOffset = 0): Date {
  const [y, m, d] = workDate.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d + dayOffset, h, mi, 0, 0);
}

/**
 * HH:MM 同士で out < in を判定する。
 * 'HH:MM' のフォーマットを前提とし、文字列比較で十分（00:00 〜 23:59）。
 */
export function isCrossMidnight(clockInHHMM: string, clockOutHHMM: string): boolean {
  if (!clockInHHMM || !clockOutHHMM) return false;
  return clockOutHHMM < clockInHHMM;
}

export interface BuildClockTimesResult {
  clockIn?: Date;
  clockOut?: Date;
  /** clockOut が翌日扱いになった場合 true */
  crossMidnight: boolean;
}

/**
 * workDate + 時刻文字列 (HH:MM) から Date を組み立てる。
 * clockOut が clockIn より早い時刻なら、clockOut を翌日扱いに補正。
 *
 * 引数が undefined の場合はその項目だけ undefined を返す。
 */
export function buildClockTimes(
  workDate: string,
  clockInHHMM?: string,
  clockOutHHMM?: string,
): BuildClockTimesResult {
  const result: BuildClockTimesResult = { crossMidnight: false };

  if (clockInHHMM) {
    result.clockIn = buildLocalDate(workDate, clockInHHMM, 0);
  }

  if (clockOutHHMM) {
    const cross = clockInHHMM ? isCrossMidnight(clockInHHMM, clockOutHHMM) : false;
    result.clockOut = buildLocalDate(workDate, clockOutHHMM, cross ? 1 : 0);
    result.crossMidnight = cross;
  }

  return result;
}
