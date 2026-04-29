export function checkOvertimeLimits(
  monthlyHours: number,
  yearlyHours: number,
): { warnings: string[] } {
  const warnings: string[] = [];
  const mh = Math.round(monthlyHours * 10) / 10;
  const yh = Math.round(yearlyHours * 10) / 10;

  // Monthly thresholds (ascending — keep all that apply)
  if (mh >= 100) {
    warnings.push(`🚨 36協定違反：月間残業が100時間の上限を超過しています（${mh}時間）`);
  } else if (mh >= 80) {
    warnings.push(`⚠ 過労死ライン：月間残業が80時間を超過しています（${mh}時間）`);
  } else if (mh >= 45) {
    warnings.push(`⚠ 月間残業が上限45時間を超過しています（${mh}時間）`);
  } else if (mh >= 36) {
    warnings.push(`月間残業が36時間を超えています（${mh}時間）`);
  }

  // Yearly thresholds
  if (yh >= 720) {
    warnings.push(`🚨 36協定違反：年間残業が720時間の上限を超過しています（${yh}時間）`);
  } else if (yh >= 360) {
    warnings.push(`⚠ 年間残業が上限360時間を超過しています（${yh}時間）`);
  } else if (yh >= 300) {
    warnings.push(`年間残業が300時間を超えています（${yh}時間）`);
  }

  return { warnings };
}
