/**
 * AgentToolsService
 *
 * AI エージェント用のツール定義 + dispatch 実装。
 *
 * Anthropic SDK の tool use で Claude が呼び出すツール群:
 *  - count_pending_approvals: 経費 / 休暇 / 勤怠修正の pending 件数
 *  - list_pending_approvals : 指定カテゴリの pending 申請の最新 N 件
 *  - count_unread_notifications: 管理者宛 (category=system) の未読通知件数
 *
 * 既存サービスを再利用するだけで、新規 DB アクセスは最小限。
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import { ExpenseService } from '../expense/expense.service';
import { LeaveService } from '../leave/leave.service';
import { AttendanceService } from '../attendance/attendance.service';
import { InvoicesService } from '../invoices/invoices.service';

export type AgentToolName =
  | 'count_pending_approvals'
  | 'list_pending_approvals'
  | 'count_unread_notifications'
  | 'get_attendance_closure_status'
  | 'close_month_attendance'
  | 'reopen_month_attendance'
  | 'list_billable_for_month'
  | 'generate_invoice_for_client'
  | 'generate_all_invoices_for_month'
  | 'list_tables'
  | 'query_records'
  | 'count_records'
  | 'get_current_datetime';

export interface ToolCallLog {
  name: string;
  input: unknown;
  resultPreview: string;
}

export interface AgentToolContext {
  actorEmployeeId: string;
  actorRole: string;
  tenantId: string;
  /** 1 リクエスト内で書き込みツールを呼び出した回数（参照渡し用にオブジェクトで持つ） */
  writeCallCount: { value: number };
}

const MAX_WRITE_CALLS = 10;
const WRITE_TOOLS = new Set<string>([
  'close_month_attendance',
  'reopen_month_attendance',
  'generate_invoice_for_client',
  'generate_all_invoices_for_month',
]);

/**
 * 読み取り専用クエリで開放するモデル一覧 (Prisma camelCase 名)。
 * - 全モデルから PII / 認証系をブロックして開放
 */
const ALLOWED_MODELS: readonly string[] = [
  'department', 'position', 'employee', 'skillsheet',
  'emergencyContact', 'dependent', 'employeeResidentTax',
  'client', 'project', 'businessCard', 'dealLog',
  'assignment', 'assignmentRateHistory',
  'attendance', 'attendanceCorrection', 'adminAttendanceEdit',
  'leaveBalance', 'leaveRequest',
  'expenseRequest', 'expenseItem', 'preApproval',
  'generalExpense', 'changeRequest',
  'payroll', 'notification', 'autoNotificationRule',
  'workRule', 'certificate', 'yearendAdjustment',
  'auditLog', 'meeting', 'candidate',
  'attendanceConfirmed', 'clientAttendanceUpload', 'clientAttendanceRecord',
  'reconciliationResult', 'reconciliationSettings',
  'delayCertificate', 'leaveOfAbsence', 'proposalEmail',
  'recruitSource', 'recruitBudget',
  'invoice', 'invoiceItem', 'freeeJournal',
  'monthlyShift', 'payrollEditHistory',
  'rateMaster', 'companyInfo', 'salaryGrade',
  'attendanceMonthlyClosure',
  'documentIssuance', 'onboardingDocument',
  // ブロック: user (パスワード), integrationToken (OAuth トークン)
];

const ALLOWED_MODEL_SET = new Set(ALLOWED_MODELS);

/** 結果から自動マスクする機密フィールド名 */
const SENSITIVE_FIELDS = new Set<string>([
  'myNumber',
  'bankAccountNumber',
  'bankAccountHolder',
  'bankName',
  'bankBranch',
  'accessToken',
  'refreshToken',
  'password',
  'passwordHash',
  'apiKey',
  'apiSecret',
  'secret',
]);

const QUERY_TAKE_DEFAULT = 20;
const QUERY_TAKE_MAX = 100;

/**
 * サーバー現在日時 + 会計年度情報。tool 結果と system prompt 注入の両方で使う。
 * 会計年度: 5月始まり (month >= 5 ? year : year - 1)
 */
export function buildCurrentDatetimeInfo() {
  const now = new Date();
  const tz = 'Asia/Tokyo';
  // 簡易: ローカルタイム前提。コンテナで TZ=Asia/Tokyo を設定する
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();
  const weekdayShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const weekdayJa = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()] + '曜日';

  const fy = m >= 5 ? y : y - 1;
  const fyStart = `${fy}-05-01`;
  const fyEnd = `${fy + 1}-04-30`;

  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${y}-${pad(m)}-${pad(d)}`;
  const currentYM = `${y}-${pad(m)}`;
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const previousYM = `${prev.y}-${pad(prev.m)}`;
  const nextYM = `${next.y}-${pad(next.m)}`;

  // ISO with offset (toISOString は UTC なので、簡易に手で +09:00 を組む。サーバーが JST 前提)
  const offsetMin = -now.getTimezoneOffset();
  const offsetSign = offsetMin >= 0 ? '+' : '-';
  const offsetH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offsetM = pad(Math.abs(offsetMin) % 60);
  const isoLocal = `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${offsetSign}${offsetH}:${offsetM}`;

  return {
    now_iso: isoLocal,
    date,
    year: y,
    month: m,
    day: d,
    weekday: weekdayShort,
    weekday_ja: weekdayJa,
    tz,
    fiscal_year: fy,
    fiscal_year_label: `${fy}年度`,
    fiscal_year_start: fyStart,
    fiscal_year_end: fyEnd,
    current_year_month: currentYM,
    previous_year_month: previousYM,
    next_year_month: nextYM,
  };
}

function redactSensitive<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.has(k)) {
        out[k] = v === null || v === undefined || v === '' ? v : '***';
      } else {
        out[k] = redactSensitive(v);
      }
    }
    return out as T;
  }
  return value;
}

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly expense: ExpenseService,
    private readonly leave: LeaveService,
    private readonly attendance: AttendanceService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Anthropic SDK 用のツール定義一覧 */
  getToolDefinitions(): Anthropic.Tool[] {
    return [
      {
        name: 'count_pending_approvals',
        description:
          '社内の未承認申請の件数をカテゴリ別に返す。' +
          'カテゴリ: 経費 (expense) / 休暇 (leave) / 勤怠修正 (attendance_correction)。' +
          'ユーザーから「未承認」「承認待ち」「滞留」「承認」関連の集計を依頼されたらまずこれを呼ぶこと。',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_pending_approvals',
        description:
          '指定カテゴリの未承認申請の最新 N 件を、申請者名・申請日・概要付きで返す。' +
          '件数だけでは不足する場合や、誰の何の申請か個別に確認したい場合に呼ぶ。',
        input_schema: {
          type: 'object' as const,
          properties: {
            category: {
              type: 'string' as const,
              enum: ['expense', 'leave', 'attendance_correction'],
              description: '対象カテゴリ',
            },
            limit: {
              type: 'integer' as const,
              minimum: 1,
              maximum: 20,
              description: '返却件数 (1-20、省略時 5)',
            },
          },
          required: ['category'],
        },
      },
      {
        name: 'count_unread_notifications',
        description:
          '管理者宛の未読通知 (category=system) の件数を返す。「アラート」「通知」関連の質問に使う。',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      // ====== 勤怠確定 ======
      {
        name: 'get_attendance_closure_status',
        description:
          '指定年月の勤怠確定状況を返す（読み取り）。確定済みか / 全社員 confirmed か / 件数 など。',
        input_schema: {
          type: 'object' as const,
          properties: {
            year: { type: 'integer' as const, minimum: 2020, maximum: 2100 },
            month: { type: 'integer' as const, minimum: 1, maximum: 12 },
          },
          required: ['year', 'month'],
        },
      },
      {
        name: 'close_month_attendance',
        description:
          '【書き込み】指定年月の月次勤怠を一括確定する (admin only)。' +
          'confirmed=false で呼ぶと dry-run（実行せず内容サマリ返却）。' +
          'ユーザーに内容を提示して確認を取った後、confirmed=true で再呼出して実際に実行する。',
        input_schema: {
          type: 'object' as const,
          properties: {
            year: { type: 'integer' as const, minimum: 2020, maximum: 2100 },
            month: { type: 'integer' as const, minimum: 1, maximum: 12 },
            confirmed: {
              type: 'boolean' as const,
              description: 'true で実際に確定実行。falseまたは省略で dry-run',
            },
          },
          required: ['year', 'month'],
        },
      },
      {
        name: 'reopen_month_attendance',
        description:
          '【書き込み】指定年月の確定済み勤怠を解除する (admin only)。close と同じ 2 段パターン。',
        input_schema: {
          type: 'object' as const,
          properties: {
            year: { type: 'integer' as const, minimum: 2020, maximum: 2100 },
            month: { type: 'integer' as const, minimum: 1, maximum: 12 },
            confirmed: { type: 'boolean' as const },
          },
          required: ['year', 'month'],
        },
      },
      // ====== 請求書発行 ======
      {
        name: 'list_billable_for_month',
        description:
          '指定対象月（YYYY-MM）に勤怠確定済みでまだ請求書未発行の社員を、クライアント別にグルーピングして返す（読み取り）。',
        input_schema: {
          type: 'object' as const,
          properties: {
            target_month: {
              type: 'string' as const,
              description: '対象月 (YYYY-MM 形式)',
            },
          },
          required: ['target_month'],
        },
      },
      {
        name: 'generate_invoice_for_client',
        description:
          '【書き込み】特定クライアントの当月請求書を勤怠ベースで発行する (admin only)。' +
          'employee_ids には list_billable_for_month で得た社員 ID を渡す。' +
          'confirmed=false で dry-run。',
        input_schema: {
          type: 'object' as const,
          properties: {
            client_id: { type: 'string' as const },
            target_month: {
              type: 'string' as const,
              description: '対象月 (YYYY-MM 形式)',
            },
            employee_ids: {
              type: 'array' as const,
              items: { type: 'string' as const },
            },
            confirmed: { type: 'boolean' as const },
          },
          required: ['client_id', 'target_month', 'employee_ids'],
        },
      },
      {
        name: 'generate_all_invoices_for_month',
        description:
          '【書き込み・一括】指定対象月の発行可能な請求書を、全クライアントについて一括発行する (admin only)。' +
          'confirmed=false → サマリ返却（クライアント数・社員数・概算合計）。' +
          'confirmed=true → 順次発行し invoice_id を返す。',
        input_schema: {
          type: 'object' as const,
          properties: {
            target_month: {
              type: 'string' as const,
              description: '対象月 (YYYY-MM 形式)',
            },
            confirmed: { type: 'boolean' as const },
          },
          required: ['target_month'],
        },
      },
      // ====== 汎用読み取り (ad-hoc query) ======
      {
        name: 'list_tables',
        description:
          'エージェントが query_records / count_records で参照可能なモデル(table)名一覧を返す（読み取り専用）。' +
          '具体的な集計やデータ取り出しを依頼されたが既存の専用ツールで対応できない場合、このツールでまずモデル名を確認してから query_records / count_records を使うこと。',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'query_records',
        description:
          '指定モデル(table)から構造化クエリで行を取得する（読み取り専用）。' +
          'table は list_tables で得られる camelCase 名 (例: employee, attendance, invoice, leaveRequest)。' +
          'where / select / orderBy / take / skip は Prisma findMany と同じ形式の JSON を渡す。' +
          'take の上限は ' + QUERY_TAKE_MAX + '。既定は ' + QUERY_TAKE_DEFAULT + '。' +
          '機密フィールド (myNumber, bankAccountNumber, accessToken 等) は自動的に "***" にマスクされる。',
        input_schema: {
          type: 'object' as const,
          properties: {
            table: { type: 'string' as const, description: 'モデル名 (camelCase)' },
            where: {
              type: 'object' as const,
              description: 'Prisma where 句 (例: { status: "pending", createdAt: { gte: "2026-04-01" } })',
            },
            select: {
              type: 'object' as const,
              description: 'Prisma select 句 (例: { id: true, name: true, employee: { select: { lastName: true } } })',
            },
            orderBy: {
              type: 'object' as const,
              description: 'Prisma orderBy 句 (例: { createdAt: "desc" })',
            },
            take: { type: 'integer' as const, minimum: 1, maximum: QUERY_TAKE_MAX },
            skip: { type: 'integer' as const, minimum: 0 },
            include: {
              type: 'object' as const,
              description: 'Prisma include 句 (リレーション展開)。select と併用不可。',
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'count_records',
        description:
          '指定モデル(table)の行数を返す（読み取り専用）。集計や件数確認に使う。',
        input_schema: {
          type: 'object' as const,
          properties: {
            table: { type: 'string' as const },
            where: { type: 'object' as const },
          },
          required: ['table'],
        },
      },
      {
        name: 'get_current_datetime',
        description:
          'サーバー現在日時 (Asia/Tokyo) と会計年度（5月始まり）を返す（読み取り専用）。' +
          '「今月」「先月」「今年度」「直近〇日」など日時依存の判断が必要なときに呼ぶ。',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    ];
  }

  /** Claude からの tool_use を実行する。常に文字列を返す（tool_result の content 用） */
  async dispatch(name: string, input: unknown, ctx: AgentToolContext): Promise<string> {
    this.logger.log(`tool_use name=${name} input=${JSON.stringify(input)} actor=${ctx.actorEmployeeId}/${ctx.actorRole}`);

    // 書き込みガード
    if (WRITE_TOOLS.has(name)) {
      if (ctx.actorRole !== 'admin') {
        return JSON.stringify({
          error: 'admin 権限が必要です。書き込みは管理者のみ実行できます。',
        });
      }
      if (ctx.writeCallCount.value >= MAX_WRITE_CALLS) {
        return JSON.stringify({
          error: `書き込み回数の上限 (${MAX_WRITE_CALLS}) に達しました。`,
        });
      }
      ctx.writeCallCount.value++;
    }

    try {
      switch (name) {
        case 'count_pending_approvals':
          return JSON.stringify(await this.countPendingApprovals(ctx));
        case 'list_pending_approvals':
          return JSON.stringify(
            await this.listPendingApprovals(input as { category: string; limit?: number }, ctx),
          );
        case 'count_unread_notifications':
          return JSON.stringify(await this.countUnreadAdminNotifications(ctx));

        // 勤怠確定
        case 'get_attendance_closure_status':
          return JSON.stringify(
            await this.getAttendanceClosureStatus(input as { year: number; month: number }, ctx),
          );
        case 'close_month_attendance':
          return JSON.stringify(
            await this.closeMonthAttendance(input as { year: number; month: number; confirmed?: boolean }, ctx),
          );
        case 'reopen_month_attendance':
          return JSON.stringify(
            await this.reopenMonthAttendance(input as { year: number; month: number; confirmed?: boolean }, ctx),
          );

        // 請求書
        case 'list_billable_for_month':
          return JSON.stringify(
            await this.listBillableForMonth(input as { target_month: string }, ctx),
          );
        case 'generate_invoice_for_client':
          return JSON.stringify(
            await this.generateInvoiceForClient(
              input as {
                client_id: string;
                target_month: string;
                employee_ids: string[];
                confirmed?: boolean;
              },
              ctx,
            ),
          );
        case 'generate_all_invoices_for_month':
          return JSON.stringify(
            await this.generateAllInvoicesForMonth(
              input as { target_month: string; confirmed?: boolean },
              ctx,
            ),
          );

        // ad-hoc 読み取り
        case 'list_tables':
          return JSON.stringify({ tables: ALLOWED_MODELS });
        case 'query_records':
          return JSON.stringify(
            await this.queryRecords(
              input as {
                table: string;
                where?: unknown;
                select?: unknown;
                include?: unknown;
                orderBy?: unknown;
                take?: number;
                skip?: number;
              },
            ),
          );
        case 'count_records':
          return JSON.stringify(
            await this.countRecords(input as { table: string; where?: unknown }),
          );

        case 'get_current_datetime':
          return JSON.stringify(buildCurrentDatetimeInfo());

        default:
          return JSON.stringify({ error: `unknown tool: ${name}` });
      }
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`tool_use error name=${name} msg=${err.message}`);
      return JSON.stringify({ error: err.message });
    }
  }

  // ==== 個別ツール実装 ====

  private async countPendingApprovals(ctx: AgentToolContext) {
    const [expense, leave, attendanceCorrection] = await Promise.all([
      this.expense.getPendingRequests(ctx.tenantId).then((r) => r.length),
      this.leave.getPendingRequests(ctx.tenantId).then((r) => r.length),
      this.attendance.getPendingCorrections(ctx.tenantId).then((r) => r.length),
    ]);
    return {
      expense,
      leave,
      attendance_correction: attendanceCorrection,
      total: expense + leave + attendanceCorrection,
    };
  }

  private async listPendingApprovals(args: { category: string; limit?: number }, ctx: AgentToolContext) {
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
    const formatName = (e?: { lastName?: string | null; firstName?: string | null; employeeCode?: string | null }) => {
      if (!e) return '不明';
      const code = e.employeeCode ? `[${e.employeeCode}]` : '';
      return `${(e.lastName ?? '')}${(e.firstName ?? '')} ${code}`.trim();
    };
    const fmtDate = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

    if (args.category === 'expense') {
      const rows = await this.expense.getPendingRequests(ctx.tenantId);
      return rows.slice(0, limit).map((r) => {
        const row = r as unknown as {
          id: string;
          createdAt?: Date;
          employee?: { lastName?: string; firstName?: string; employeeCode?: string };
          title?: string;
          items?: unknown[];
        };
        return {
          id: row.id,
          applicant: formatName(row.employee),
          applied_at: fmtDate(row.createdAt),
          title: row.title ?? '(タイトル無し)',
          item_count: Array.isArray(row.items) ? row.items.length : undefined,
        };
      });
    }
    if (args.category === 'leave') {
      const rows = await this.leave.getPendingRequests(ctx.tenantId);
      return rows.slice(0, limit).map((r) => {
        const row = r as unknown as Record<string, unknown> & {
          id: string;
          createdAt?: Date;
          employee?: { lastName?: string; firstName?: string; employeeCode?: string };
          leaveType?: string;
          startDate?: Date;
          endDate?: Date;
        };
        return {
          id: row.id,
          applicant: formatName(row.employee),
          applied_at: fmtDate(row.createdAt),
          leave_type: row.leaveType ?? '',
          start_date: fmtDate(row.startDate),
          end_date: fmtDate(row.endDate),
        };
      });
    }
    if (args.category === 'attendance_correction') {
      const rows = await this.attendance.getPendingCorrections(ctx.tenantId);
      return rows.slice(0, limit).map((r) => {
        const row = r as unknown as {
          id: string;
          createdAt?: Date;
          employee?: { lastName?: string; firstName?: string; employeeCode?: string };
          attendance?: { workDate?: Date };
          reason?: string;
        };
        return {
          id: row.id,
          applicant: formatName(row.employee),
          applied_at: fmtDate(row.createdAt),
          target_date: fmtDate(row.attendance?.workDate),
          reason: row.reason ?? '',
        };
      });
    }
    return { error: `unknown category: ${args.category}` };
  }

  private async countUnreadAdminNotifications(ctx: AgentToolContext) {
    const count = await this.db.notification.count({
      where: { isRead: false, category: 'system', tenantId: ctx.tenantId },
    });
    return { unread_admin_notifications: count };
  }

  // ===== 勤怠確定 =====

  private async getAttendanceClosureStatus(args: { year: number; month: number }, ctx: AgentToolContext) {
    const status = await this.attendance.getClosureStatus(args.year, args.month, ctx.tenantId);
    return {
      year: args.year,
      month: args.month,
      status,
    };
  }

  private async closeMonthAttendance(
    args: { year: number; month: number; confirmed?: boolean },
    ctx: AgentToolContext,
  ) {
    const status = await this.attendance.getClosureStatus(args.year, args.month, ctx.tenantId);
    if (!args.confirmed) {
      return {
        dry_run: true,
        year: args.year,
        month: args.month,
        status,
        message:
          '実行する場合は同じツールを confirmed=true で呼んでください。実行前に必ずユーザーに対象件数とサマリを提示し承認を取ってください。',
      };
    }
    this.logger.log(
      `agent_write close_month_attendance year=${args.year} month=${args.month} actor=${ctx.actorEmployeeId}`,
    );
    const result = await this.attendance.closeMonth(args.year, args.month, ctx.actorEmployeeId, ctx.tenantId);
    return {
      dry_run: false,
      closed: true,
      year: args.year,
      month: args.month,
      result,
    };
  }

  private async reopenMonthAttendance(
    args: { year: number; month: number; confirmed?: boolean },
    ctx: AgentToolContext,
  ) {
    const status = await this.attendance.getClosureStatus(args.year, args.month, ctx.tenantId);
    if (!args.confirmed) {
      return {
        dry_run: true,
        year: args.year,
        month: args.month,
        status,
        message:
          '確定解除を実行する場合は confirmed=true で再度呼んでください。実行前に必ずユーザーに確認を取ってください。',
      };
    }
    this.logger.log(
      `agent_write reopen_month_attendance year=${args.year} month=${args.month} actor=${ctx.actorEmployeeId}`,
    );
    const result = await this.attendance.reopenMonth(args.year, args.month, ctx.actorEmployeeId, ctx.tenantId);
    return {
      dry_run: false,
      reopened: true,
      year: args.year,
      month: args.month,
      result,
    };
  }

  // ===== 請求書発行 =====

  private async listBillableForMonth(args: { target_month: string }, ctx: AgentToolContext) {
    const result = await this.invoices.getBillableEmployees(args.target_month, ctx.tenantId);
    // BillableGroup は client 別グルーピング想定
    return {
      target_month: args.target_month,
      ...result,
    };
  }

  private async generateInvoiceForClient(
    args: {
      client_id: string;
      target_month: string;
      employee_ids: string[];
      confirmed?: boolean;
    },
    ctx: AgentToolContext,
  ) {
    if (!args.employee_ids?.length) {
      return { error: 'employee_ids が空です' };
    }
    if (!args.confirmed) {
      return {
        dry_run: true,
        client_id: args.client_id,
        target_month: args.target_month,
        employee_count: args.employee_ids.length,
        message:
          '請求書を発行する場合は confirmed=true で再度呼んでください。実行前にユーザーに件数を提示し承認を取ってください。',
      };
    }
    this.logger.log(
      `agent_write generate_invoice_for_client client=${args.client_id} month=${args.target_month} emps=${args.employee_ids.length}`,
    );
    try {
      const inv = await this.invoices.generateFromAttendance({
        clientId: args.client_id,
        targetMonth: args.target_month,
        employeeIds: args.employee_ids,
      }, ctx.tenantId);
      return {
        dry_run: false,
        generated: true,
        client_id: args.client_id,
        target_month: args.target_month,
        invoice: {
          id: (inv as { id?: string }).id,
          invoiceNo: (inv as { invoiceNo?: string }).invoiceNo,
          totalAmount: (inv as { totalAmount?: number }).totalAmount,
        },
      };
    } catch (e) {
      const err = e as Error;
      return { error: err.message, client_id: args.client_id };
    }
  }

  // ===== ad-hoc 読み取り =====

  private getModelDelegate(table: string): { findMany: (args: unknown) => Promise<unknown>; count: (args: unknown) => Promise<number> } | null {
    if (!ALLOWED_MODEL_SET.has(table)) return null;
    // db を Record として扱い動的アクセス
    const dyn = this.db as unknown as Record<string, unknown>;
    const delegate = dyn[table] as
      | { findMany: (args: unknown) => Promise<unknown>; count: (args: unknown) => Promise<number> }
      | undefined;
    if (!delegate || typeof delegate.findMany !== 'function') return null;
    return delegate;
  }

  private async queryRecords(args: {
    table: string;
    where?: unknown;
    select?: unknown;
    include?: unknown;
    orderBy?: unknown;
    take?: number;
    skip?: number;
  }) {
    if (!ALLOWED_MODEL_SET.has(args.table)) {
      return {
        error: `テーブル '${args.table}' は参照不可。list_tables で利用可能なモデル名を確認してください。`,
      };
    }
    const delegate = this.getModelDelegate(args.table);
    if (!delegate) {
      return { error: `モデル '${args.table}' が見つかりません` };
    }
    const take = Math.min(Math.max(args.take ?? QUERY_TAKE_DEFAULT, 1), QUERY_TAKE_MAX);

    // select と include は併用不可（Prisma 制約）
    const findArgs: Record<string, unknown> = { take };
    if (args.where !== undefined) findArgs.where = args.where;
    if (args.orderBy !== undefined) findArgs.orderBy = args.orderBy;
    if (args.skip !== undefined) findArgs.skip = args.skip;
    if (args.select !== undefined) {
      findArgs.select = args.select;
    } else if (args.include !== undefined) {
      findArgs.include = args.include;
    }

    try {
      const rows = (await delegate.findMany(findArgs)) as unknown[];
      const redacted = redactSensitive(rows);
      return {
        table: args.table,
        rows: redacted,
        count: rows.length,
        truncated: rows.length === take,
      };
    } catch (e) {
      const err = e as Error;
      return { error: `クエリ失敗: ${err.message}`, table: args.table };
    }
  }

  private async countRecords(args: { table: string; where?: unknown }) {
    if (!ALLOWED_MODEL_SET.has(args.table)) {
      return { error: `テーブル '${args.table}' は参照不可。` };
    }
    const delegate = this.getModelDelegate(args.table);
    if (!delegate) {
      return { error: `モデル '${args.table}' が見つかりません` };
    }
    try {
      const countArgs: Record<string, unknown> = {};
      if (args.where !== undefined) countArgs.where = args.where;
      const count = await delegate.count(countArgs);
      return { table: args.table, count };
    } catch (e) {
      const err = e as Error;
      return { error: `count 失敗: ${err.message}`, table: args.table };
    }
  }

  private async generateAllInvoicesForMonth(
    args: {
      target_month: string;
      confirmed?: boolean;
    },
    ctx: AgentToolContext,
  ) {
    const billable = await this.invoices.getBillableEmployees(args.target_month, ctx.tenantId);
    const groups = (billable as { billableGroups?: Array<{ clientId: string; clientName?: string; employees: Array<{ employeeId: string }>; estimatedTotal?: number }> }).billableGroups ?? [];

    if (groups.length === 0) {
      return {
        target_month: args.target_month,
        dry_run: !args.confirmed,
        message: '発行可能な請求書はありません',
        clients: 0,
      };
    }

    const summary = groups.map((g) => ({
      client_id: g.clientId,
      client_name: g.clientName,
      employee_count: g.employees.length,
      estimated_total: g.estimatedTotal,
    }));
    const totalEmployees = groups.reduce((s, g) => s + g.employees.length, 0);
    const totalEstimated = groups.reduce((s, g) => s + (g.estimatedTotal ?? 0), 0);

    if (!args.confirmed) {
      return {
        dry_run: true,
        target_month: args.target_month,
        clients: groups.length,
        total_employees: totalEmployees,
        estimated_total: totalEstimated,
        breakdown: summary,
        message:
          '一括発行する場合は同ツールを confirmed=true で再度呼んでください。実行前に必ずユーザーに上記サマリを提示して承認を取ってください。',
      };
    }

    this.logger.log(
      `agent_write generate_all_invoices_for_month month=${args.target_month} clients=${groups.length}`,
    );

    const results: Array<{ client_id: string; ok: boolean; invoice_id?: string; invoice_no?: string; error?: string }> = [];
    for (const g of groups) {
      try {
        const inv = await this.invoices.generateFromAttendance({
          clientId: g.clientId,
          targetMonth: args.target_month,
          employeeIds: g.employees.map((e) => e.employeeId),
        }, ctx.tenantId);
        results.push({
          client_id: g.clientId,
          ok: true,
          invoice_id: (inv as { id?: string }).id,
          invoice_no: (inv as { invoiceNo?: string }).invoiceNo,
        });
      } catch (e) {
        results.push({
          client_id: g.clientId,
          ok: false,
          error: (e as Error).message,
        });
      }
    }

    return {
      dry_run: false,
      target_month: args.target_month,
      generated_count: results.filter((r) => r.ok).length,
      failed_count: results.filter((r) => !r.ok).length,
      results,
    };
  }
}
