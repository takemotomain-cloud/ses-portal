/**
 * 勤怠時刻ユーティリティ
 *
 * 日跨ぎ勤務（19:00 出勤 → 翌 02:00 退勤）を扱うため、退勤時刻が出勤時刻より早い場合は
 * 退勤側を翌日扱いに補正する。サーバー側にも同様の補正があるが、フロント側で先に
 * 正しい ISO を送ることで二重防御。
 */

/** HH:MM 同士で out < in かを判定 */
export function isCrossMidnight(clockInHHMM: string, clockOutHHMM: string): boolean {
  if (!clockInHHMM || !clockOutHHMM) return false;
  return clockOutHHMM < clockInHHMM;
}

/** workDate (YYYY-MM-DD) + HH:MM → ローカル ISO 文字列 (オフセット付き) を組み立て */
function combineLocal(workDate: string, hhmm: string, dayOffset = 0): string {
  const [y, m, d] = workDate.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d + dayOffset, h, mi).toISOString();
}

export interface CombinedDateTime {
  clockIn?: string;
  clockOut?: string;
  /** clockOut が翌日扱いになった場合 true */
  crossMidnight: boolean;
}

/**
 * workDate + 時刻 (HH:MM) を ISO 文字列に変換。
 * clockOut < clockIn なら clockOut を翌日扱いに補正。
 */
export function combineDateTimeAware(
  workDate: string,
  clockInHHMM?: string,
  clockOutHHMM?: string,
): CombinedDateTime {
  const result: CombinedDateTime = { crossMidnight: false };
  if (clockInHHMM) {
    result.clockIn = combineLocal(workDate, clockInHHMM, 0);
  }
  if (clockOutHHMM) {
    const cross = clockInHHMM ? isCrossMidnight(clockInHHMM, clockOutHHMM) : false;
    result.clockOut = combineLocal(workDate, clockOutHHMM, cross ? 1 : 0);
    result.crossMidnight = cross;
  }
  return result;
}

/**
 * ISO 文字列 (Date) と workDate を比較し、clockOut が workDate の翌日以降なら true。
 * 既存レコード表示時に「(翌)」バッジを出すか判定するのに使う。
 */
export function isClockOutNextDay(workDate: string, clockOutISO: string | null): boolean {
  if (!clockOutISO) return false;
  const d = new Date(clockOutISO);
  const [y, m, day] = workDate.split('-').map(Number);
  // ローカル日付で比較
  return (
    d.getFullYear() > y ||
    (d.getFullYear() === y && d.getMonth() + 1 > m) ||
    (d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() > day)
  );
}
