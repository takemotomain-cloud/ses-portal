import * as holidayJp from '@holiday-jp/holiday_jp';

interface AttendanceRecord {
  workDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  overtimeMinutes: number | null;
}

function isLegalHoliday(date: Date): boolean {
  return date.getDay() === 0 || holidayJp.isHoliday(date);
}

function calcLateNightMinutes(clockIn: Date, clockOut: Date): number {
  let total = 0;
  const start = clockIn.getTime();
  const end = clockOut.getTime();

  // Iterate minute-by-minute
  for (let t = start; t < end; t += 60_000) {
    const hour = new Date(t).getHours();
    if (hour >= 22 || hour < 5) {
      total++;
    }
  }
  return total;
}

export function calculateOvertimeBreakdown(attendances: AttendanceRecord[]): {
  regularOtMinutes: number;
  excessOtMinutes: number;
  lateNightMinutes: number;
  holidayMinutes: number;
} {
  let lateNightMinutes = 0;
  let holidayMinutes = 0;
  let nonHolidayOtMinutes = 0;

  for (const att of attendances) {
    const workDate = new Date(att.workDate);
    const holiday = isLegalHoliday(workDate);

    if (att.clockIn && att.clockOut) {
      const clockIn = new Date(att.clockIn);
      const clockOut = new Date(att.clockOut);
      lateNightMinutes += calcLateNightMinutes(clockIn, clockOut);

      if (holiday) {
        const workMinutes = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 60_000);
        holidayMinutes += Math.round(workMinutes);
      }
    }

    if (!holiday && att.overtimeMinutes != null && att.overtimeMinutes > 0) {
      nonHolidayOtMinutes += att.overtimeMinutes;
    }
  }

  const OT_LIMIT = 3600; // 60h in minutes
  const regularOtMinutes = Math.min(nonHolidayOtMinutes, OT_LIMIT);
  const excessOtMinutes = Math.max(0, nonHolidayOtMinutes - OT_LIMIT);

  return { regularOtMinutes, excessOtMinutes, lateNightMinutes, holidayMinutes };
}
