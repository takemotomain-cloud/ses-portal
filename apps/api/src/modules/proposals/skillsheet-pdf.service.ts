/**
 * SkillsheetPdfService — 提案メール添付用スキルシート PDF 生成（N4）
 *
 * 対象社員の DB データから HTML を組み立て、Puppeteer（Chromium）で PDF 化する。
 * 提案時はプライバシー配慮で氏名はイニシャルのみ表示。
 *
 * 注意:
 *   - Puppeteer の Chromium バイナリがインストールされていない環境では
 *     generateSkillsheetPdf() が例外を投げるので、呼び出し側は
 *     try-catch で包み「PDF 添付できなかったら本文のみ送信」にフォールバックする。
 *   - 本番環境では headless="new" + --no-sandbox オプションを想定。
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/** カナ→ローマ字イニシャル変換 */
const KANA_MAP: Record<string, string> = {
  'ア':'A','イ':'I','ウ':'U','エ':'E','オ':'O',
  'カ':'K','キ':'K','ク':'K','ケ':'K','コ':'K',
  'サ':'S','シ':'S','ス':'S','セ':'S','ソ':'S',
  'タ':'T','チ':'T','ツ':'T','テ':'T','ト':'T',
  'ナ':'N','ニ':'N','ヌ':'N','ネ':'N','ノ':'N',
  'ハ':'H','ヒ':'H','フ':'H','ヘ':'H','ホ':'H',
  'マ':'M','ミ':'M','ム':'M','メ':'M','モ':'M',
  'ヤ':'Y','ユ':'Y','ヨ':'Y',
  'ラ':'R','リ':'R','ル':'R','レ':'R','ロ':'R',
  'ワ':'W','ヲ':'W','ン':'N',
  'ガ':'G','ギ':'G','グ':'G','ゲ':'G','ゴ':'G',
  'ザ':'Z','ジ':'Z','ズ':'Z','ゼ':'Z','ゾ':'Z',
  'ダ':'D','ヂ':'D','ヅ':'D','デ':'D','ド':'D',
  'バ':'B','ビ':'B','ブ':'B','ベ':'B','ボ':'B',
  'パ':'P','ピ':'P','プ':'P','ペ':'P','ポ':'P',
};

function toInitial(nameKana: string): string {
  if (!nameKana) return '';
  const parts = nameKana.trim().split(/\s+/);
  if (parts.length < 2) return '';
  const lastInit = KANA_MAP[parts[0].charAt(0)] || parts[0].charAt(0);
  const firstInit = KANA_MAP[parts[1].charAt(0)] || parts[1].charAt(0);
  return `${firstInit}.${lastInit}.`;
}

function calcAge(birthDate: Date | null): string {
  if (!birthDate) return '--';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return `${age}歳`;
}

function esc(s: any): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

@Injectable()
export class SkillsheetPdfService {
  private readonly logger = new Logger(SkillsheetPdfService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 対象社員のスキルシートを 1 つの PDF（複数ページ）にまとめて返す
   *
   * @param tenantId テナント ID
   * @param employeeIds 社員 ID 配列
   * @returns PDF の Buffer。1 人も対象がいない場合は null
   */
  async generateSkillsheetPdf(tenantId: string, employeeIds: string[]): Promise<Buffer | null> {
    if (!employeeIds || employeeIds.length === 0) return null;

    const employees = await this.db.employee.findMany({
      where: { id: { in: employeeIds }, tenantId, deletedAt: null },
      include: {
        department: { select: { name: true } },
        skillsheet: true,
      },
    });
    if (employees.length === 0) return null;

    const html = this.buildHtml(employees);

    // Puppeteer を require で動的ロード（Chromium が未インストールでも初期化を遅らせる）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');

    let browser: any = null;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      if (browser) {
        try { await browser.close(); } catch { /* noop */ }
      }
    }
  }

  /**
   * 複数社員分を結合した HTML を組み立てる
   */
  private buildHtml(employees: any[]): string {
    const pages = employees.map((emp, i) => this.buildEmployeePage(emp, i === 0)).join('\n');
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>スキルシート</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;
    font-size: 12px;
    color: #222;
    line-height: 1.7;
  }
  .page {
    page-break-after: always;
    padding: 24px;
  }
  .page:last-child { page-break-after: auto; }
  .title {
    text-align: center;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.3em;
    padding-bottom: 12px;
    border-bottom: 2px solid #222;
    margin-bottom: 24px;
  }
  table.info {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  table.info th, table.info td {
    border: 1px solid rgba(0,0,0,0.15);
    padding: 6px 10px;
    text-align: left;
    font-weight: normal;
  }
  table.info th {
    background: #F7F7F5;
    width: 100px;
    font-weight: 500;
  }
  .section-heading {
    font-size: 13px;
    font-weight: 600;
    margin: 18px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #222;
  }
  .prose { font-size: 12px; }
  table.projects {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.projects th, table.projects td {
    border: 1px solid rgba(0,0,0,0.15);
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  table.projects th {
    background: #F7F7F5;
    font-weight: 500;
  }
</style>
</head>
<body>
${pages}
</body>
</html>`;
  }

  private buildEmployeePage(emp: any, isFirst: boolean): string {
    const nameKana = `${emp.lastNameKana || ''} ${emp.firstNameKana || ''}`.trim();
    const initial = toInitial(nameKana) || '--';
    const age = calcAge(emp.birthDate);
    const genderMap: Record<string, string> = { male: '男性', female: '女性', other: 'その他' };
    const gender = genderMap[emp.gender] || '--';
    const dept = emp.department?.name || '--';
    const station = emp.station || '--';
    const qualifications: string[] = Array.isArray(emp.qualifications) ? emp.qualifications : [];

    const sh = emp.skillsheet;
    const experience = sh?.experience || '--';
    const selfPr = sh?.selfPr || '';
    const summaryAffiliation = sh?.summaryAffiliation || '自社正社員';
    const summaryMonth = sh?.summaryMonth || '--';
    const summaryRate = sh?.summaryRate || '--';

    const projects: any[] = Array.isArray(sh?.projects) ? sh.projects : [];

    const aggregateTech = (): { tech: Set<string>; tools: Set<string> } => {
      const tech = new Set<string>();
      const tools = new Set<string>();
      const techKeys = ['languages', 'db', 'fw', 'sqlTool', 'editor', 'container', 'buildTool', 'cicd', 'infra', 'cloud'];
      const toolKeys = ['otherTools', 'ticketMgmt', 'vcs', 'communication'];
      for (const p of projects) {
        for (const k of techKeys) if (Array.isArray(p[k])) p[k].forEach((v: string) => tech.add(v));
        for (const k of toolKeys) if (Array.isArray(p[k])) p[k].forEach((v: string) => tools.add(v));
      }
      return { tech, tools };
    };
    const { tech, tools } = aggregateTech();

    const projectRows = projects.map((p) => {
      const period = `${esc(p.startYm || '')}〜${esc(p.endYm || '現在')}`;
      const envParts: string[] = [];
      for (const k of ['languages','db','fw','cloud','infra']) {
        if (Array.isArray(p[k]) && p[k].length) envParts.push(p[k].join('/'));
      }
      return `<tr>
        <td style="white-space:nowrap">${period}</td>
        <td><div style="font-weight:500">${esc(p.name || '')}</div><div style="color:#666;font-size:10px">${esc(p.client || '')}</div></td>
        <td style="white-space:nowrap">${esc(p.role || '')}</td>
        <td>${esc(envParts.join(' / '))}</td>
        <td>${esc(p.detail || '')}</td>
      </tr>`;
    }).join('\n');

    return `<div class="page">
  <div class="title">スキルシート</div>
  <table class="info">
    <tr><th>氏名</th><td>${esc(initial)}</td><th>年齢</th><td>${esc(age)}</td></tr>
    <tr><th>性別</th><td>${esc(gender)}</td><th>所属</th><td>${esc(summaryAffiliation)}</td></tr>
    <tr><th>部署</th><td>${esc(dept)}</td><th>経験年数</th><td>${esc(experience)}</td></tr>
    <tr><th>最寄駅</th><td colspan="3">${esc(station)}</td></tr>
    <tr><th>稼働開始</th><td>${esc(summaryMonth)}</td><th>単価</th><td>${esc(summaryRate)}</td></tr>
  </table>

  ${selfPr ? `<div class="section-heading">自己PR</div><div class="prose">${esc(selfPr)}</div>` : ''}

  <div class="section-heading">対応スキル</div>
  <div class="prose">${esc(Array.from(tech).join(', ') || '--')}</div>

  <div class="section-heading">その他ツール</div>
  <div class="prose">${esc(Array.from(tools).join(', ') || '--')}</div>

  ${qualifications.length ? `<div class="section-heading">保有資格</div><div class="prose">${qualifications.map(q => esc(q)).join('<br/>')}</div>` : ''}

  ${projectRows ? `
  <div class="section-heading">業務経歴</div>
  <table class="projects">
    <thead>
      <tr>
        <th style="width:13%">期間</th>
        <th style="width:26%">案件名 / クライアント</th>
        <th style="width:10%">役割</th>
        <th style="width:21%">使用技術</th>
        <th>業務内容</th>
      </tr>
    </thead>
    <tbody>
      ${projectRows}
    </tbody>
  </table>` : ''}
</div>`;
  }
}
