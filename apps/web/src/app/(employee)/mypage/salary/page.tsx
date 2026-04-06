/**
 * 給与明細ページ
 *
 * UIモックのpage-salaryを再現。
 * 月切替 + 差引支給額 + 支給・控除の2カラム。
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';

interface SalaryData {
  earnings: [string, number][];
  deductions: [string, number][];
}

export default function SalaryPage() {
  const { user } = useAuth();

  // 月一覧を生成（現在月から過去12ヶ月）
  const generateMonths = () => {
    const result: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push(`${d.getFullYear()}年${d.getMonth() + 1}月`);
    }
    return result;
  };

  const months = generateMonths();
  const [monthIdx, setMonthIdx] = useState(0);
  const currentMonth = months[monthIdx];
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchSalary() {
      setLoading(true);
      try {
        const match = currentMonth.match(/(\d+)年(\d+)月/);
        const y = match ? parseInt(match[1]) : new Date().getFullYear();
        const m = match ? parseInt(match[2]) : new Date().getMonth() + 1;
        const res = await apiClient<SalaryData>(`/salary/${y}/${m}`);
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSalary();
    return () => { cancelled = true; };
  }, [currentMonth]);

  const totalEarnings = data ? data.earnings.reduce((s, [, v]) => s + v, 0) : 0;
  const totalDeductions = data ? data.deductions.reduce((s, [, v]) => s + v, 0) : 0;
  const netSalary = totalEarnings - totalDeductions;

  const { toast, ToastUI } = useToast();

  function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString(); }

  const handleDownloadPDF = useCallback(() => {
    if (!data) return;
    const match = currentMonth.match(/(\d+)年(\d+)月/);
    const y = match ? parseInt(match[1]) : 2026;
    const m = match ? parseInt(match[2]) : 3;
    const reiwa = y - 2018;
    const lastDay = new Date(y, m, 0).getDate();
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const employeeName = user?.name || '';
    const employeeCode = (user as any)?.employeeCode || '';
    const companyName = '';
    const pad = (n: number) => String(n).padStart(2, '0');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>給与明細書 ${currentMonth}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif; color: #222; background: #fff; }
  @page { size: A4 portrait; margin: 12mm 16mm; }
  @media print { body { padding: 0; } }

  .page { max-width: 960px; margin: 0 auto; padding: 24px 40px; }

  /* ===== ヘッダー ===== */
  .hdr { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; margin-bottom: 18px; }
  .hdr-left {}
  .hdr-title { font-size: 18px; font-weight: 800; letter-spacing: .5px; }
  .hdr-sub { font-size: 12px; color: #777; margin-top: 4px; }
  .hdr-right { text-align: right; }
  .hdr-company { font-size: 15px; font-weight: 700; letter-spacing: 1px; }
  .hdr-emp { font-size: 11px; color: #888; margin-top: 6px; }
  .hdr-name { font-size: 24px; font-weight: 800; margin-top: 2px; letter-spacing: 2px; }

  /* ===== 差引支給額 ===== */
  .net { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 14px 28px; margin-bottom: 20px; display: flex; align-items: baseline; gap: 12px; }
  .net-label { font-size: 13px; color: #666; font-weight: 500; }
  .net-amount { font-size: 36px; font-weight: 800; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
  .net-yen { font-size: 16px; font-weight: 500; color: #666; margin-left: 2px; }

  /* ===== 明細テーブル ===== */
  .tables { display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px; }
  .tbl-wrap { flex: 1; }
  .tbl-head { font-size: 13px; font-weight: 700; padding: 8px 14px; margin-bottom: 0; border-radius: 4px 4px 0 0; }
  .tbl-head.earn { background: #ecfdf5; color: #15803d; }
  .tbl-head.ded { background: #fef2f2; color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; }
  table td, table th { padding: 7px 14px; font-size: 13px; }
  table tbody tr { border-bottom: 1px solid #eee; }
  table tbody tr:last-child { border-bottom: none; }
  table th { text-align: left; font-weight: 400; color: #555; }
  table td { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
  table tfoot tr { border-top: 1px solid #333; }
  table tfoot th { font-weight: 700; color: #222; }
  table tfoot td { font-weight: 700; font-size: 14px; }

  /* ===== フッター ===== */
  .ftr { padding-top: 16px; border-top: 1px solid #ddd; text-align: center; }
  .ftr span { font-size: 10px; color: #aaa; }
</style>
</head><body>
<div class="page">

  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-title">${y}年(令和${pad(reiwa)}年) ${pad(m)}月度 給与明細書</div>
      <div class="hdr-sub">支給日 ${y}年${pad(m)}月${lastDay}日 ｜ 計算期間 ${prevYear}年${pad(prevMonth)}月01日 〜 ${prevYear}年${pad(prevMonth)}月${prevLastDay}日</div>
    </div>
    <div class="hdr-right">
      <div class="hdr-company">${companyName}</div>
      <div class="hdr-emp">社員番号 ${employeeCode}</div>
      <div class="hdr-name">${employeeName}</div>
    </div>
  </div>

  <div class="net">
    <span class="net-label">差引支給額</span>
    <span class="net-amount">${fmt(netSalary)}<span class="net-yen">円</span></span>
  </div>

  <div class="tables">
    <div class="tbl-wrap">
      <div class="tbl-head earn">支給項目</div>
      <table>
        <tbody>
          ${data.earnings.map(([l, v]) => `<tr><th>${l}</th><td>${fmt(v)} 円</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><th>支給合計</th><td>${fmt(totalEarnings)} 円</td></tr></tfoot>
      </table>
    </div>
    <div class="tbl-wrap">
      <div class="tbl-head ded">控除項目</div>
      <table>
        <tbody>
          ${data.deductions.map(([l, v]) => `<tr><th>${l}</th><td>${fmt(v)} 円</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><th>控除合計</th><td>${fmt(totalDeductions)} 円</td></tr></tfoot>
      </table>
    </div>
  </div>

  <div class="ftr">
    <span>${companyName} ｜ 電子交付 ｜ ${new Date().toLocaleDateString('ja-JP')} 発行</span>
  </div>

</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      toast('PDF印刷ダイアログを開いています');
    }
  }, [currentMonth, data, netSalary, totalEarnings, totalDeductions, toast, user?.name]);

  return (
    <div className="space-y-5">
      {/* 月切り替え */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setMonthIdx(Math.min(monthIdx + 1, months.length - 1))}
          disabled={monthIdx >= months.length - 1}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-lg font-medium min-w-[120px] text-center">{currentMonth}</span>
        <button
          onClick={() => setMonthIdx(Math.max(monthIdx - 1, 0))}
          disabled={monthIdx <= 0}
          className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-secondary hover:bg-page disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-secondary">読み込み中...</div>
      ) : !data ? (
        <div className="card p-10 text-center text-secondary">給与データはありません</div>
      ) : (
        <>
          {/* 差引支給額 */}
          <div className="card p-5 text-center">
            <div className="text-sm text-secondary mb-1">差引支給額</div>
            <div className="text-4xl font-medium tabular-nums">
              ¥{fmt(netSalary)}
            </div>
          </div>

          {/* 支給・控除 2カラム */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 支給 */}
            <div className="card p-0">
              <div className="px-4 py-3 border-b border-border bg-status-green-bg/30">
                <span className="text-md font-semibold text-status-green-text">支給</span>
              </div>
              <div className="px-4 py-2">
                {data.earnings.map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-border-light text-md">
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">{fmt(value)}円</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 mt-1 font-semibold text-md">
                  <span>支給合計</span>
                  <span className="tabular-nums">{fmt(totalEarnings)}円</span>
                </div>
              </div>
            </div>

            {/* 控除 */}
            <div className="card p-0">
              <div className="px-4 py-3 border-b border-border bg-status-red-bg/30">
                <span className="text-md font-semibold text-status-red-text">控除</span>
              </div>
              <div className="px-4 py-2">
                {data.deductions.map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-border-light text-md">
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">{fmt(value)}円</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 mt-1 font-semibold text-md">
                  <span>控除合計</span>
                  <span className="tabular-nums">{fmt(totalDeductions)}円</span>
                </div>
              </div>
            </div>
          </div>

          {/* PDFダウンロード */}
          <button
            onClick={handleDownloadPDF}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-md font-medium text-primary hover:bg-page transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDFダウンロード
          </button>
        </>
      )}
      <ToastUI />
    </div>
  );
}
