/**
 * PayslipPdfService — 給与明細PDFの生成 + Drive保存 + 履歴記録
 *
 * payroll.confirmPayrollRecord から呼ばれ、確定された給与レコードを
 * 1社員1ファイルのPDFにし、Driveの「対象月」フォルダに格納する。
 *
 * フォルダ階層: SES Portal/{年度}/{YYYY年M月}/給与明細/
 *   ※ 給与明細だけは「対象月」基準（他書類は発行月基準）
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { PdfService } from '../pdf/pdf.service';

const yen = (n: number | null | undefined) =>
  n === null || n === undefined ? '0' : n.toLocaleString('ja-JP');

@Injectable()
export class PayslipPdfService {
  private readonly logger = new Logger(PayslipPdfService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly drive: GoogleDriveService,
    private readonly pdf: PdfService,
  ) {}

  /**
   * 給与明細PDFを発行（生成→Drive保存→DocumentIssuance記録）
   * Drive未連携・PDF生成失敗時は警告ログのみ（給与確定処理を止めない）
   */
  async issueForPayroll(tenantId: string, payrollId: string, issuedByUserId?: string): Promise<void> {
    try {
      const payroll = await this.db.payroll.findUnique({
        where: { id: payrollId, tenantId },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              lastName: true,
              firstName: true,
            },
          },
        },
      });
      if (!payroll || !payroll.employee) {
        this.logger.warn(`Payroll not found: ${payrollId}`);
        return;
      }

      const [year, month] = payroll.targetMonth.split('-').map(Number);
      const targetDate = new Date(year, month - 1, 1);
      const fullName = `${payroll.employee.lastName}${payroll.employee.firstName}`;
      const ymStr = `${year}${String(month).padStart(2, '0')}`;
      const fileName = `${payroll.employee.employeeCode}_${fullName}_${ymStr}.pdf`;

      // 会社情報を取得（あれば）
      let companyName = '';
      try {
        const company = await this.db.companyInfo.findUnique({ where: { tenantId } });
        companyName = company?.name || '';
      } catch { /* CompanyInfoモデルがない場合は無視 */ }

      const html = this.buildHtml({
        companyName,
        employeeCode: payroll.employee.employeeCode,
        fullName,
        year,
        month,
        baseSalary: Number(payroll.baseSalary || 0),
        fixedOvertimePay: Number(payroll.fixedOvertimePay || 0),
        overtimePay: Number(payroll.overtimePay || 0),
        commuteAllowance: Number(payroll.commuteAllowance || 0),
        otherAllowance: Number(payroll.otherAllowance || 0),
        absenceDeduction: Number(payroll.absenceDeduction || 0),
        grossSalary: Number(payroll.grossSalary || 0),
        healthInsurance: Number(payroll.healthInsurance || 0),
        nursingCareInsurance: Number(payroll.nursingCareInsurance || 0),
        pension: Number(payroll.pension || 0),
        employmentInsurance: Number(payroll.employmentInsurance || 0),
        incomeTax: Number(payroll.incomeTax || 0),
        residentTax: Number(payroll.residentTax || 0),
        totalDeductions: Number(payroll.totalDeductions || 0),
        netSalary: Number(payroll.netSalary || 0),
        issuedAt: new Date(),
      });

      const pdfBuffer = await this.pdf.generatePdfFromHtml(html);

      let driveFileId: string | null = null;
      let driveViewLink: string | null = null;
      if (await this.drive.isEnabled(tenantId)) {
        try {
          const result = await this.drive.saveDocumentPdf(tenantId, {
            categoryFolder: '給与明細',
            fiscalYearDate: targetDate, // 給与明細は対象月で年度判定
            monthDate: targetDate,      // 対象月で格納
            fileName,
            pdf: pdfBuffer,
          });
          driveFileId = result.fileId;
          driveViewLink = result.webViewLink;
        } catch (e) {
          this.logger.warn(`Drive 保存失敗: ${(e as Error).message}`);
        }
      } else {
        this.logger.warn('Drive 未連携のため給与明細PDFは保存されません');
      }

      await this.db.documentIssuance.create({
        data: {
          tenantId,
          employeeId: payroll.employee.id,
          documentType: 'payslip',
          targetDate,
          fileName,
          driveFileId,
          driveViewLink,
          issuedBy: issuedByUserId || null,
          metadata: {
            payrollId: payroll.id,
            targetMonth: payroll.targetMonth,
          },
        },
      });

      this.logger.log(`給与明細PDF発行: ${fileName} (drive=${driveFileId || 'none'})`);
    } catch (e) {
      // 給与確定の本筋を止めないよう、ここでは握りつぶしてログのみ
      this.logger.error(`給与明細PDF発行失敗 payrollId=${payrollId}: ${(e as Error).message}`, (e as Error).stack);
    }
  }

  /**
   * 単発で給与明細 PDF を生成して返す（プレビュー用）
   */
  async generate(payroll: any, company: any): Promise<Buffer> {
    const [year, month] = payroll.targetMonth.split('-').map(Number);
    const fullName = `${payroll.employee.lastName}${payroll.employee.firstName}`;

    const html = this.buildHtml({
      companyName: company?.name || '',
      employeeCode: payroll.employee.employeeCode,
      fullName,
      year,
      month,
      baseSalary: Number(payroll.baseSalary || 0),
      fixedOvertimePay: Number(payroll.fixedOvertimePay || 0),
      overtimePay: Number(payroll.overtimePay || 0),
      commuteAllowance: Number(payroll.commuteAllowance || 0),
      otherAllowance: Number(payroll.otherAllowance || 0),
      absenceDeduction: Number(payroll.absenceDeduction || 0),
      grossSalary: Number(payroll.grossSalary || 0),
      healthInsurance: Number(payroll.healthInsurance || 0),
      nursingCareInsurance: Number(payroll.nursingCareInsurance || 0),
      pension: Number(payroll.pension || 0),
      employmentInsurance: Number(payroll.employmentInsurance || 0),
      incomeTax: Number(payroll.incomeTax || 0),
      residentTax: Number(payroll.residentTax || 0),
      totalDeductions: Number(payroll.totalDeductions || 0),
      netSalary: Number(payroll.netSalary || 0),
      issuedAt: new Date(),
    });

    return this.pdf.generatePdfFromHtml(html);
  }

  /* ------------------------------------------------------------------ */
  /*  HTML テンプレ                                                       */
  /* ------------------------------------------------------------------ */

  private buildHtml(d: {
    companyName: string;
    employeeCode: string;
    fullName: string;
    year: number;
    month: number;
    baseSalary: number;
    fixedOvertimePay: number;
    overtimePay: number;
    commuteAllowance: number;
    otherAllowance: number;
    absenceDeduction: number;
    grossSalary: number;
    healthInsurance: number;
    nursingCareInsurance: number;
    pension: number;
    employmentInsurance: number;
    incomeTax: number;
    residentTax: number;
    totalDeductions: number;
    netSalary: number;
    issuedAt: Date;
  }): string {
    const esc = PdfService.esc;
    const issuedStr = `${d.issuedAt.getFullYear()}年${d.issuedAt.getMonth() + 1}月${d.issuedAt.getDate()}日`;

    // 支給合計（grossSalary）と控除合計を分けて表示
    const totalAllowance =
      d.baseSalary + d.fixedOvertimePay + d.overtimePay +
      d.commuteAllowance + d.otherAllowance - d.absenceDeduction;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>給与明細 ${d.year}年${d.month}月</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
    font-size: 12px; color: #222; line-height: 1.6;
  }
  .page { padding: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
  .title { font-size: 22px; font-weight: 600; letter-spacing: 0.2em; }
  .meta { font-size: 11px; color: #555; text-align: right; }
  .info {
    width: 100%; border-collapse: collapse; margin-bottom: 16px;
  }
  .info th, .info td {
    border: 1px solid rgba(0,0,0,0.15); padding: 6px 10px; text-align: left; font-weight: normal;
  }
  .info th { background: #F7F7F5; width: 110px; font-weight: 500; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  .card { border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; }
  .card-title {
    font-size: 13px; font-weight: 600; padding: 8px 12px;
    background: #F7F7F5; border-bottom: 1px solid rgba(0,0,0,0.15);
  }
  table.detail { width: 100%; border-collapse: collapse; }
  table.detail td {
    padding: 5px 12px; border-top: 1px solid rgba(0,0,0,0.08);
  }
  table.detail td:first-child { color: #555; }
  table.detail td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  table.detail tr.subtotal td {
    border-top: 1px solid #222; font-weight: 600;
  }
  .net {
    margin-top: 18px; padding: 14px 16px; border: 2px solid #222;
    display: flex; justify-content: space-between; align-items: center;
  }
  .net-label { font-size: 14px; font-weight: 600; }
  .net-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .footer { margin-top: 20px; font-size: 10px; color: #888; text-align: right; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="title">給与明細書</div>
    <div class="meta">
      ${esc(d.companyName || '株式会社')}<br/>
      発行日: ${esc(issuedStr)}
    </div>
  </div>

  <table class="info">
    <tr>
      <th>対象月</th><td>${d.year}年${d.month}月</td>
      <th>社員番号</th><td>${esc(d.employeeCode)}</td>
    </tr>
    <tr>
      <th>氏名</th><td colspan="3">${esc(d.fullName)} 殿</td>
    </tr>
  </table>

  <div class="grid">
    <div class="card">
      <div class="card-title">支給</div>
      <table class="detail">
        <tr><td>基本給</td><td>${yen(d.baseSalary)}</td></tr>
        <tr><td>固定残業代</td><td>${yen(d.fixedOvertimePay)}</td></tr>
        <tr><td>残業手当</td><td>${yen(d.overtimePay)}</td></tr>
        <tr><td>通勤手当</td><td>${yen(d.commuteAllowance)}</td></tr>
        <tr><td>その他手当</td><td>${yen(d.otherAllowance)}</td></tr>
        <tr><td>欠勤控除</td><td>-${yen(d.absenceDeduction)}</td></tr>
        <tr class="subtotal"><td>支給合計</td><td>${yen(totalAllowance)}</td></tr>
      </table>
    </div>
    <div class="card">
      <div class="card-title">控除</div>
      <table class="detail">
        <tr><td>健康保険</td><td>${yen(d.healthInsurance)}</td></tr>
        <tr><td>介護保険</td><td>${yen(d.nursingCareInsurance)}</td></tr>
        <tr><td>厚生年金</td><td>${yen(d.pension)}</td></tr>
        <tr><td>雇用保険</td><td>${yen(d.employmentInsurance)}</td></tr>
        <tr><td>所得税</td><td>${yen(d.incomeTax)}</td></tr>
        <tr><td>住民税</td><td>${yen(d.residentTax)}</td></tr>
        <tr class="subtotal"><td>控除合計</td><td>${yen(d.totalDeductions)}</td></tr>
      </table>
    </div>
  </div>

  <div class="net">
    <div class="net-label">差引支給額</div>
    <div class="net-value">¥ ${yen(d.netSalary)}</div>
  </div>

  <div class="footer">本書類は SES Portal によって自動生成されています。</div>
</div>
</body>
</html>`;
  }
}
