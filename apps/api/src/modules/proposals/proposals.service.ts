/**
 * Proposals Service
 *
 * クライアントへの人材提案メール送信・履歴管理。
 * 複数社員を同時に提案可能。
 * サマリテキスト生成 + スキルシートPDF添付。
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as nodemailer from 'nodemailer';

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
  if (!birthDate) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return `${age}歳`;
}

const GENDER_MAP: Record<string, string> = { male: '男性', female: '女性', other: 'その他' };

/** 技術カテゴリキー */
const TECH_KEYS = [
  'languages', 'db', 'fw', 'ticketMgmt', 'sqlTool', 'editor',
  'container', 'buildTool', 'vcs', 'cicd', 'infra', 'cloud',
  'communication', 'otherTools',
];

function aggregateTech(projects: any[]): { tech: string[]; otherTools: string[] } {
  const techSet = new Set<string>();
  const otherSet = new Set<string>();
  for (const p of projects) {
    for (const key of TECH_KEYS) {
      if (key === 'otherTools' || key === 'ticketMgmt' || key === 'vcs' || key === 'communication') {
        if (Array.isArray(p[key])) p[key].forEach((v: string) => otherSet.add(v));
      } else {
        if (Array.isArray(p[key])) p[key].forEach((v: string) => techSet.add(v));
      }
    }
  }
  return { tech: Array.from(techSet), otherTools: Array.from(otherSet) };
}

function buildSummaryText(emp: any, skillsheet: any): string {
  const nameKana = `${emp.lastNameKana || ''} ${emp.firstNameKana || ''}`.trim();
  const initial = toInitial(nameKana);
  const age = calcAge(emp.birthDate);
  const gender = GENDER_MAP[emp.gender] || emp.gender || '--';
  const station = emp.station || '--';
  const projects = Array.isArray(skillsheet?.projects) ? skillsheet.projects : [];
  const { tech, otherTools } = aggregateTech(projects);
  const affiliation = skillsheet?.summaryAffiliation || '自社正社員';
  const availableMonth = skillsheet?.summaryMonth || '--';
  const rate = skillsheet?.summaryRate || '--';
  const rateFormatted = rate && rate !== '--' ? Number(rate.replace(/,/g, '')).toLocaleString() : rate;
  const personality = skillsheet?.selfPr || '--';

  const lines: string[] = [];
  lines.push('【基本情報】');
  lines.push(`・氏名：${initial}`);
  lines.push(`・年齢：${age}`);
  lines.push(`・性別：${gender}`);
  lines.push('');
  lines.push('【所属】');
  lines.push(`・${affiliation}`);
  lines.push('');
  lines.push('【最寄り】');
  lines.push(`・${station}`);
  lines.push('');
  lines.push('【対応スキル】');
  lines.push(tech.join(', ') || '--');
  lines.push('');
  lines.push('【その他ツール】');
  lines.push(otherTools.join(', ') || '--');
  lines.push('');
  lines.push('【稼働開始】');
  lines.push(`・${availableMonth}`);
  lines.push('');
  lines.push('【希望条件】');
  lines.push(`・単価：${rateFormatted}`);
  lines.push('');
  lines.push('【人物・強み】');
  lines.push(personality);
  return lines.join('\n');
}

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * 提案メール送信
   */
  async send(data: {
    clientId: string;
    employeeIds: string[];
    toEmail: string;
    contactPerson?: string;
    customMessage?: string;
  }) {
    // クライアント取得
    const client = await this.db.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new NotFoundException('クライアントが見つかりません');

    // 社員＋スキルシート取得
    const employees = await this.db.employee.findMany({
      where: { id: { in: data.employeeIds }, deletedAt: null },
      include: { skillsheet: true },
    });
    if (employees.length === 0) throw new NotFoundException('対象社員が見つかりません');

    // サマリテキスト生成（複数人分）
    const summaries = employees.map(emp => {
      const nameKana = `${emp.lastNameKana || ''} ${emp.firstNameKana || ''}`.trim();
      const initial = toInitial(nameKana);
      const summary = buildSummaryText(emp, emp.skillsheet);
      return { initial, summary, employeeId: emp.id };
    });

    const personName = data.contactPerson || client.contactPerson || 'ご担当者';
    const countText = employees.length === 1 ? '1名' : `${employees.length}名`;

    // メール本文
    const bodyLines: string[] = [];
    bodyLines.push(`${client.name}`);
    bodyLines.push(`${personName}様`);
    bodyLines.push('');
    bodyLines.push('お世話になっております。');
    bodyLines.push('株式会社Lerviaの営業担当でございます。');
    bodyLines.push('');
    if (data.customMessage) {
      bodyLines.push(data.customMessage);
      bodyLines.push('');
    }
    bodyLines.push(`下記の通り、エンジニア${countText}をご提案させていただきます。`);
    bodyLines.push('');

    for (let i = 0; i < summaries.length; i++) {
      if (summaries.length > 1) {
        bodyLines.push(`━━━━━━━━━━━━━━━━━━`);
        bodyLines.push(`■ ${i + 1}人目`);
        bodyLines.push(`━━━━━━━━━━━━━━━━━━`);
      }
      bodyLines.push(summaries[i].summary);
      bodyLines.push('');
    }

    bodyLines.push('詳細なスキルシートを添付しておりますので、');
    bodyLines.push('ご確認いただけますと幸いです。');
    bodyLines.push('');
    bodyLines.push('ご不明点がございましたらお気軽にお申し付けください。');
    bodyLines.push('何卒よろしくお願いいたします。');
    bodyLines.push('');
    bodyLines.push('--');
    bodyLines.push('株式会社Lervia');
    bodyLines.push('Email: sales@lervia.co.jp');

    const bodyText = bodyLines.join('\n');
    const subject = `【人材ご提案】エンジニア${countText}のご紹介`;

    // SMTP送信（仮設定: 開発環境では Ethereal / Mailtrap 等を想定）
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    let sendStatus = 'sent';
    try {
      await transporter.sendMail({
        from: '"株式会社Lervia" <sales@lervia.co.jp>',
        to: data.toEmail,
        subject,
        text: bodyText,
        // TODO: PDF添付は Puppeteer でスキルシートPDF生成後に対応
      });
      this.logger.log(`提案メール送信成功: ${data.toEmail} (${countText})`);
    } catch (err: any) {
      this.logger.warn(`SMTP送信失敗（履歴は保存）: ${err?.message}`);
      sendStatus = 'failed';
    }

    // 送信履歴を保存
    const record = await this.db.proposalEmail.create({
      data: {
        clientId: data.clientId,
        toEmail: data.toEmail,
        subject,
        bodyText,
        employeeIds: data.employeeIds,
        status: sendStatus,
      },
    });

    return { id: record.id, status: sendStatus, subject, bodyText };
  }

  /**
   * プレビュー（送信せず本文のみ返す）
   */
  async preview(data: {
    clientId: string;
    employeeIds: string[];
    contactPerson?: string;
    customMessage?: string;
  }) {
    const client = await this.db.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new NotFoundException('クライアントが見つかりません');

    const employees = await this.db.employee.findMany({
      where: { id: { in: data.employeeIds }, deletedAt: null },
      include: { skillsheet: true },
    });
    if (employees.length === 0) throw new NotFoundException('対象社員が見つかりません');

    const summaries = employees.map(emp => {
      const nameKana = `${emp.lastNameKana || ''} ${emp.firstNameKana || ''}`.trim();
      const initial = toInitial(nameKana);
      const summary = buildSummaryText(emp, emp.skillsheet);
      return { initial, summary, employeeId: emp.id };
    });

    const personName = data.contactPerson || client.contactPerson || 'ご担当者';
    const countText = employees.length === 1 ? '1名' : `${employees.length}名`;

    const bodyLines: string[] = [];
    bodyLines.push(`${client.name}`);
    bodyLines.push(`${personName}様`);
    bodyLines.push('');
    bodyLines.push('お世話になっております。');
    bodyLines.push('株式会社Lerviaの営業担当でございます。');
    bodyLines.push('');
    if (data.customMessage) {
      bodyLines.push(data.customMessage);
      bodyLines.push('');
    }
    bodyLines.push(`下記の通り、エンジニア${countText}をご提案させていただきます。`);
    bodyLines.push('');

    for (let i = 0; i < summaries.length; i++) {
      if (summaries.length > 1) {
        bodyLines.push(`━━━━━━━━━━━━━━━━━━`);
        bodyLines.push(`■ ${i + 1}人目`);
        bodyLines.push(`━━━━━━━━━━━━━━━━━━`);
      }
      bodyLines.push(summaries[i].summary);
      bodyLines.push('');
    }

    bodyLines.push('詳細なスキルシートを添付しておりますので、');
    bodyLines.push('ご確認いただけますと幸いです。');
    bodyLines.push('');
    bodyLines.push('ご不明点がございましたらお気軽にお申し付けください。');
    bodyLines.push('何卒よろしくお願いいたします。');
    bodyLines.push('');
    bodyLines.push('--');
    bodyLines.push('株式会社Lervia');
    bodyLines.push('Email: sales@lervia.co.jp');

    const subject = `【人材ご提案】エンジニア${countText}のご紹介`;
    return { subject, bodyText: bodyLines.join('\n') };
  }

  /**
   * メール送信なしで提案をDB保存（draft状態）
   */
  async createWithoutEmail(data: {
    clientId: string;
    employeeIds: string[];
    projectName?: string;
  }) {
    const client = await this.db.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new NotFoundException('クライアントが見つかりません');

    const record = await this.db.proposalEmail.create({
      data: {
        clientId: data.clientId,
        toEmail: '',
        subject: data.projectName ? `提案: ${data.projectName}` : '（メール未送信）',
        bodyText: '',
        employeeIds: data.employeeIds,
        status: 'draft',
      },
    });

    this.logger.log(`提案追加（メールなし）: ${client.name} (${data.employeeIds.length}名)`);
    return { id: record.id, status: 'draft' };
  }

  /**
   * 既存の提案（draft）に対してメールを送信
   */
  async sendExisting(id: string, data: {
    toEmail: string;
    contactPerson?: string;
    customMessage?: string;
  }) {
    const proposal = await this.db.proposalEmail.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('提案が見つかりません');

    const employeeIds = Array.isArray(proposal.employeeIds) ? proposal.employeeIds as string[] : [];

    // 既存のsendロジックを再利用
    const result = await this.send({
      clientId: proposal.clientId,
      employeeIds,
      toEmail: data.toEmail,
      contactPerson: data.contactPerson,
      customMessage: data.customMessage,
    });

    // 元のdraftレコードを更新（sent/failedに変更）
    await this.db.proposalEmail.update({
      where: { id },
      data: {
        toEmail: data.toEmail,
        subject: result.subject,
        bodyText: result.bodyText,
        status: result.status,
        sentAt: new Date(),
      },
    });

    // sendが別レコードを作成するので、重複を削除
    if (result.id !== id) {
      await this.db.proposalEmail.delete({ where: { id: result.id } });
    }

    return { id, status: result.status, subject: result.subject };
  }

  /**
   * クライアント別の送信履歴
   */
  async findByClient(clientId: string) {
    const records = await this.db.proposalEmail.findMany({
      where: { clientId },
      orderBy: { sentAt: 'desc' },
    });

    // employeeIds から社員名を取得
    const allEmpIds = new Set<string>();
    records.forEach(r => {
      const ids = Array.isArray(r.employeeIds) ? r.employeeIds as string[] : [];
      ids.forEach(id => allEmpIds.add(id));
    });

    const employees = await this.db.employee.findMany({
      where: { id: { in: Array.from(allEmpIds) } },
      select: { id: true, lastName: true, firstName: true, lastNameKana: true, firstNameKana: true },
    });
    const empMap = new Map(employees.map(e => [e.id, e]));

    return records.map(r => {
      const ids = Array.isArray(r.employeeIds) ? r.employeeIds as string[] : [];
      return {
        id: r.id,
        toEmail: r.toEmail,
        subject: r.subject,
        status: r.status,
        sentAt: r.sentAt,
        employees: ids.map(id => {
          const e = empMap.get(id);
          if (!e) return { id, name: '不明' };
          const kana = `${e.lastNameKana || ''} ${e.firstNameKana || ''}`.trim();
          return { id, name: `${e.lastName} ${e.firstName}`, initial: toInitial(kana) };
        }),
      };
    });
  }
}
