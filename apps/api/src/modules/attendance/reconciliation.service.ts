/**
 * Reconciliation Service — 勤怠突合サービス
 *
 * 機能A: 現場勤怠表の自動読取り（Excel/CSV/画像/PDF → Claude APIで構造化）
 * 機能B: 自社勤怠データとの自動突合（差異検出・確定）
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { STANDARD_WORK_MINUTES } from '@ses-portal/shared';
import { GoogleDriveService } from '../google-drive/google-drive.service';

/** Claude APIで構造化されたレコード */
export interface ParsedRecord {
  date: string;       // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  work_hours: number | null;
  type: string;       // 通常/有給/欠勤/祝日
}

export interface ParsedAttendance {
  employee_name: string | null;
  year_month: string | null;
  client: string | null;
  records: ParsedRecord[];
  summary: {
    total_work_days: number | null;
    total_work_hours: number | null;
    overtime_hours: number | null;
  };
}

/** 突合設定 */
interface ReconcileSettings {
  timeToleranceMin: number;
  hoursTolerance: number;
  defaultStartTime: string;
}

const DEFAULT_SETTINGS: ReconcileSettings = {
  timeToleranceMin: 15,
  hoursTolerance: 0.25,
  defaultStartTime: '09:00',
};

/** Claude APIプロンプト */
const SYSTEM_PROMPT = `あなたは勤怠表データを構造化するアシスタントです。
与えられた勤怠表の内容を読み取り、必ず以下のJSON形式のみで応答してください。
前後の説明文やマークダウンは一切不要です。JSONのみを返してください。

出力形式:
{
  "employee_name": "社員名（読取れない場合はnull）",
  "year_month": "YYYY-MM（読取れない場合はnull）",
  "client": "クライアント名（読取れない場合はnull）",
  "records": [
    {
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM（読取れない場合はnull）",
      "end_time": "HH:MM（読取れない場合はnull）",
      "break_minutes": 60,
      "work_hours": 8.0,
      "type": "通常"
    }
  ],
  "summary": {
    "total_work_days": 20,
    "total_work_hours": 160.0,
    "overtime_hours": 12.0
  }
}

ルール:
- 日付はYYYY-MM-DD、時刻はHH:MM形式に統一
- typeは「通常」「有給」「欠勤」「祝日」のいずれか
- 「出勤」「始業」「IN」「開始」等は start_time として扱う
- 「退勤」「終業」「OUT」「終了」等は end_time として扱う
- 「休憩」「Break」等は break_minutes として扱う
- 「稼働」「実働」「勤務時間」等は work_hours として扱う
- 読取り不可の箇所は null を返す
- 土日祝で出勤記録がない日は含めない
- summaryの各値が読取れない場合はnullを返す`;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly googleDrive: GoogleDriveService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /* ======================================
   * 機能A: ファイルアップロード＋構造化
   * ====================================== */

  /**
   * ファイルをアップロードしてClaude APIで構造化する
   */
  /**
   * ファイルを解析のみ行う（DB保存なし）。一括アップロード用。
   */
  async parseOnly(
    file: Express.Multer.File,
    yearMonth: string,
  ): Promise<{ employeeName: string | null; records: any[]; summary: any; client: string | null; yearMonth: string }> {
    this.logger.log(`parseOnly: originalname=${file.originalname}, path=${file.path}, mimetype=${file.mimetype}, size=${file.size}`);

    if (!this.anthropic) {
      throw new BadRequestException('ANTHROPIC_API_KEY が設定されていません');
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    let fileType: string;
    if (['xlsx', 'xls'].includes(ext)) fileType = 'xlsx';
    else if (ext === 'csv') fileType = 'csv';
    else if (ext === 'pdf') fileType = 'pdf';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) fileType = 'image';
    else throw new BadRequestException(`未対応のファイル形式: ${ext}`);

    let parsed: ParsedAttendance;
    if (fileType === 'xlsx') {
      parsed = await this.parseExcel(file.path, yearMonth);
    } else if (fileType === 'csv') {
      parsed = await this.parseCsv(file.buffer || readFileSync(file.path), yearMonth);
    } else {
      parsed = await this.parseImage(file.path, file.mimetype, yearMonth);
    }

    // 対象月とファイル月の不一致チェック
    if (parsed.year_month && parsed.year_month !== yearMonth) {
      throw new BadRequestException(
        `ファイルの対象月（${parsed.year_month}）と選択された対象月（${yearMonth}）が一致しません`,
      );
    }

    return {
      employeeName: parsed.employee_name,
      records: parsed.records,
      summary: parsed.summary,
      client: parsed.client,
      yearMonth: parsed.year_month || yearMonth,
    };
  }

  /**
   * 社員IDから社員情報を取得
   */
  async getEmployee(employeeId: string) {
    return this.db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, lastName: true, firstName: true, employeeCode: true },
    });
  }

  /**
   * 対象月に稼働情報（active Assignment）があるかチェック
   */
  async hasActiveAssignment(employeeId: string, yearMonth: string): Promise<boolean> {
    const [y, m] = yearMonth.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 0)); // 月末日

    const assignment = await this.db.assignment.findFirst({
      where: {
        employeeId,
        status: 'active',
        deletedAt: null,
        startDate: { lte: monthEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: monthStart } },
        ],
      },
    });

    return !!assignment;
  }

  /**
   * 対象月に稼働中の社員一覧を取得
   */
  async findActiveEmployees(yearMonth: string) {
    const [y, m] = yearMonth.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 0));

    const assignments = await this.db.assignment.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        startDate: { lte: monthEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: monthStart } },
        ],
      },
      include: {
        employee: {
          select: { id: true, lastName: true, firstName: true, employeeCode: true },
        },
      },
      orderBy: { employee: { lastName: 'asc' } },
    });

    // 同一社員の重複を排除
    const seen = new Set<string>();
    return assignments
      .filter(a => {
        if (seen.has(a.employeeId)) return false;
        seen.add(a.employeeId);
        return true;
      })
      .map(a => ({
        id: a.employee.id,
        name: `${a.employee.lastName} ${a.employee.firstName}`,
        employeeCode: a.employee.employeeCode,
      }));
  }

  /**
   * 稼働情報のdefaultStartTimeを取得
   */
  async getDefaultStartTime(employeeId: string, yearMonth: string): Promise<string | null> {
    const [y, m] = yearMonth.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 0));

    const assignment = await this.db.assignment.findFirst({
      where: {
        employeeId,
        status: 'active',
        deletedAt: null,
        startDate: { lte: monthEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: monthStart } },
        ],
      },
      select: { defaultStartTime: true, project: { select: { defaultStartTime: true } } },
    });

    // 案件（Project）の開始時刻を優先、なければAssignment自体の値
    return assignment?.project?.defaultStartTime || assignment?.defaultStartTime || null;
  }

  /**
   * 開始時間がないレコードを稼働情報の開始時刻から自動補完
   * 開始時刻 + 稼働時間 + 休憩1h で終了時刻を計算
   */
  fillMissingStartTime(records: ParsedRecord[], defaultStartTime: string): ParsedRecord[] {
    return records.map(r => {
      if (r.start_time || r.type !== 'weekday' || !r.work_hours) return r;

      // 開始時刻をパース
      const [sh, sm] = defaultStartTime.split(':').map(Number);
      const startMin = sh * 60 + (sm || 0);
      const breakMin = r.break_minutes ?? 60; // 休憩は原則1時間
      const endMin = startMin + Math.round(r.work_hours * 60) + breakMin;

      const startTime = `${String(sh).padStart(2, '0')}:${String(sm || 0).padStart(2, '0')}`;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      return {
        ...r,
        start_time: startTime,
        end_time: r.end_time || endTime,
        break_minutes: breakMin,
      };
    });
  }

  /**
   * 社員名からDBの社員を検索してマッチング
   */
  async matchEmployeeByName(name: string) {
    if (!name) return null;

    // スペース区切りで姓名分割（全角・半角スペース対応）
    const parts = name.trim().split(/[\s　]+/);
    const lastName = parts[0];
    const firstName = parts.length > 1 ? parts[1] : null;

    // 完全一致（姓+名）
    if (firstName) {
      const exact = await this.db.employee.findFirst({
        where: { lastName, firstName, deletedAt: null },
        select: { id: true, lastName: true, firstName: true, employeeCode: true },
      });
      if (exact) return exact;
    }

    // 姓のみで検索
    const byLastName = await this.db.employee.findMany({
      where: { lastName, deletedAt: null },
      select: { id: true, lastName: true, firstName: true, employeeCode: true },
    });
    if (byLastName.length === 1) return byLastName[0];

    // 名のみで検索（フルネームが1単語の場合）
    if (!firstName) {
      const byFirst = await this.db.employee.findMany({
        where: { firstName: lastName, deletedAt: null },
        select: { id: true, lastName: true, firstName: true, employeeCode: true },
      });
      if (byFirst.length === 1) return byFirst[0];
    }

    return null;
  }

  /**
   * 解析済みデータをDBに保存して突合実行
   */
  async saveAndReconcile(
    employeeId: string,
    yearMonth: string,
    parsedData: { records: any[]; summary: any; client: string | null },
    fileName: string,
    clientId?: string,
  ) {
    const upload = await this.db.clientAttendanceUpload.create({
      data: {
        employeeId,
        clientId: clientId || null,
        yearMonth,
        fileName,
        fileType: 'bulk',
        status: 'uploaded',
        rawJson: parsedData as any,
      },
    });

    if (parsedData.records.length > 0) {
      await this.db.clientAttendanceRecord.createMany({
        data: parsedData.records.map(r => ({
          uploadId: upload.id,
          workDate: new Date(r.date),
          startTime: r.start_time,
          endTime: r.end_time,
          breakMinutes: r.break_minutes,
          workHours: r.work_hours,
          dayType: this.mapDayType(r.type),
          note: null,
        })),
      });
    }

    await this.db.clientAttendanceUpload.update({
      where: { id: upload.id },
      data: { status: 'parsed' },
    });

    // 突合実行
    const reconciliation = await this.reconcile(upload.id, employeeId);
    return { uploadId: upload.id, reconciliation };
  }

  async uploadAndParse(
    file: Express.Multer.File,
    employeeId: string,
    yearMonth: string,
    clientId?: string,
  ) {
    if (!this.anthropic) {
      throw new BadRequestException('ANTHROPIC_API_KEY が設定されていません');
    }

    // ファイル形式の判定
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    let fileType: string;
    if (['xlsx', 'xls'].includes(ext)) fileType = 'xlsx';
    else if (ext === 'csv') fileType = 'csv';
    else if (ext === 'pdf') fileType = 'pdf';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) fileType = 'image';
    else throw new BadRequestException(`未対応のファイル形式: ${ext}`);

    // multerは日本語ファイル名をlatin1でエンコードするのでUTF-8にデコード
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // アップロード履歴を作成
    const upload = await this.db.clientAttendanceUpload.create({
      data: {
        employeeId,
        clientId: clientId || null,
        yearMonth,
        fileName: originalName,
        filePath: file.path,
        fileType,
        status: 'uploaded',
      },
    });

    try {
      // ファイル形式に応じた前処理 → Claude APIで構造化
      let parsed: ParsedAttendance;

      if (fileType === 'xlsx') {
        parsed = await this.parseExcel(file.path, yearMonth);
      } else if (fileType === 'csv') {
        parsed = await this.parseCsv(file.buffer || readFileSync(file.path), yearMonth);
      } else if (fileType === 'image' || fileType === 'pdf') {
        parsed = await this.parseImage(file.path, file.mimetype, yearMonth);
      } else {
        throw new BadRequestException('未対応の形式です');
      }

      // 開始時間がないレコードを稼働情報から自動補完
      const defaultStart = await this.getDefaultStartTime(employeeId, yearMonth);
      if (defaultStart) {
        parsed.records = this.fillMissingStartTime(parsed.records, defaultStart);
      }

      // レコードをDBに保存
      if (parsed.records.length > 0) {
        await this.db.clientAttendanceRecord.createMany({
          data: parsed.records.map(r => ({
            uploadId: upload.id,
            workDate: new Date(r.date),
            startTime: r.start_time,
            endTime: r.end_time,
            breakMinutes: r.break_minutes,
            workHours: r.work_hours,
            dayType: this.mapDayType(r.type),
            note: null,
          })),
        });
      }

      // アップロードのステータスと生JSONを更新
      await this.db.clientAttendanceUpload.update({
        where: { id: upload.id },
        data: {
          rawJson: parsed as any,
          status: 'parsed',
        },
      });

      this.logger.log(`勤怠表を解析完了: upload=${upload.id}, records=${parsed.records.length}`);

      // 対象月とファイル月の不一致チェック
      if (parsed.year_month && parsed.year_month !== yearMonth) {
        await this.db.clientAttendanceUpload.update({
          where: { id: upload.id },
          data: { status: 'error' },
        });
        throw new BadRequestException(
          `ファイルの対象月（${parsed.year_month}）と選択された対象月（${yearMonth}）が一致しません`,
        );
      }

      return {
        uploadId: upload.id,
        employeeName: parsed.employee_name,
        yearMonth: parsed.year_month || yearMonth,
        client: parsed.client,
        records: parsed.records,
        summary: parsed.summary,
      };
    } catch (error) {
      // エラー時はステータスを更新
      if (error instanceof BadRequestException) throw error;
      await this.db.clientAttendanceUpload.update({
        where: { id: upload.id },
        data: { status: 'error' },
      });
      throw error;
    }
  }

  /** Excelファイルの解析 */
  private async parseExcel(filePath: string, yearMonth: string): Promise<ParsedAttendance> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // シート内容をテキストに変換
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const text = `以下はExcel勤怠表の内容です。対象年月は ${yearMonth} です。\n\n${csv}`;

    return this.callClaudeText(text);
  }

  /** CSVファイルの解析 */
  private async parseCsv(buffer: Buffer, yearMonth: string): Promise<ParsedAttendance> {
    const text = `以下はCSV形式の勤怠表です。対象年月は ${yearMonth} です。\n\n${buffer.toString('utf-8')}`;
    return this.callClaudeText(text);
  }

  /** 画像/PDFの解析（Vision） */
  private async parseImage(filePath: string, mimeType: string, yearMonth: string): Promise<ParsedAttendance> {
    const fileBuffer = readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    const isPdf = mimeType === 'application/pdf';

    const contentBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: (mimeType.startsWith('image/') ? mimeType : 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        };

    const response = await this.anthropic!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `この勤怠表を読み取ってJSON形式で出力してください。対象年月は ${yearMonth} です。`,
            },
          ],
        },
      ],
    });

    return this.extractJson(response);
  }

  /** Claude APIにテキストを送信して構造化 */
  private async callClaudeText(text: string): Promise<ParsedAttendance> {
    const response = await this.anthropic!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: text },
      ],
    });

    return this.extractJson(response);
  }

  /** Claude APIレスポンスからJSONを抽出 */
  private extractJson(response: Anthropic.Message): ParsedAttendance {
    const textBlock = response.content.find(c => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new BadRequestException('Claude APIからのレスポンスが不正です');
    }

    let jsonStr = textBlock.text.trim();
    // ```json ... ``` で囲まれている場合
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new BadRequestException('勤怠表の解析結果をパースできませんでした。別の形式で再アップロードしてください。');
    }
  }

  /** 日本語の勤務種別をコードに変換 */
  private mapDayType(type: string): string {
    const map: Record<string, string> = {
      '通常': 'normal',
      '有給': 'paid_leave',
      '欠勤': 'absent',
      '祝日': 'holiday',
    };
    return map[type] || 'normal';
  }

  /* ======================================
   * 機能B: 自動突合
   * ====================================== */

  /**
   * 現場データと自社データを突合する
   */
  async reconcile(uploadId: string, employeeId: string) {
    // アップロード情報を取得
    const upload = await this.db.clientAttendanceUpload.findUnique({
      where: { id: uploadId },
      include: { records: true },
    });

    if (!upload) throw new NotFoundException('アップロードデータが見つかりません');
    if (upload.employeeId !== employeeId) {
      throw new BadRequestException('対象社員が一致しません');
    }

    // 突合設定を取得
    const settings = upload.clientId
      ? await this.db.reconciliationSettings.findUnique({ where: { clientId: upload.clientId } })
      : null;
    const config: ReconcileSettings = {
      timeToleranceMin: settings?.timeToleranceMin ?? DEFAULT_SETTINGS.timeToleranceMin,
      hoursTolerance: Number(settings?.hoursTolerance ?? DEFAULT_SETTINGS.hoursTolerance),
      defaultStartTime: settings?.defaultStartTime ?? DEFAULT_SETTINGS.defaultStartTime,
    };

    // 対象月の自社勤怠データを取得
    const [yearStr, monthStr] = upload.yearMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const systemRecords = await this.db.attendance.findMany({
      where: {
        employeeId,
        workDate: { gte: startDate, lte: endDate },
      },
      orderBy: { workDate: 'asc' },
    });

    // 日付をキーにしたマップを作成
    const clientMap = new Map<string, typeof upload.records[0]>();
    for (const rec of upload.records) {
      const dateKey = new Date(rec.workDate).toISOString().split('T')[0];
      clientMap.set(dateKey, rec);
    }

    const systemMap = new Map<string, typeof systemRecords[0]>();
    for (const rec of systemRecords) {
      const dateKey = new Date(rec.workDate).toISOString().split('T')[0];
      systemMap.set(dateKey, rec);
    }

    // 全日付の集合
    const allDates = new Set([...clientMap.keys(), ...systemMap.keys()]);
    const sortedDates = [...allDates].sort();

    // 既存の突合結果を削除
    await this.db.reconciliationResult.deleteMany({ where: { uploadId } });

    // 突合実行
    const results: any[] = [];
    for (const dateStr of sortedDates) {
      const clientRec = clientMap.get(dateStr);
      const systemRec = systemMap.get(dateStr);

      const result = this.compareRecords(dateStr, clientRec, systemRec, config);
      results.push(result);
    }

    // 突合結果をDBに保存
    if (results.length > 0) {
      await this.db.reconciliationResult.createMany({
        data: results.map(r => ({
          uploadId,
          workDate: new Date(r.date),
          matchStatus: r.matchStatus,
          clientStart: r.clientStart,
          clientEnd: r.clientEnd,
          clientBreak: r.clientBreak,
          clientHours: r.clientHours,
          systemStart: r.systemStart,
          systemEnd: r.systemEnd,
          systemBreak: r.systemBreak,
          systemHours: r.systemHours,
          resolvedBy: r.resolvedBy,
          resolvedStart: r.resolvedStart,
          resolvedEnd: r.resolvedEnd,
          resolvedBreak: r.resolvedBreak,
          resolvedHours: r.resolvedHours,
        })),
      });
    }

    // ステータス更新
    await this.db.clientAttendanceUpload.update({
      where: { id: uploadId },
      data: { status: 'reconciled' },
    });

    // サマリー計算
    const matchCount = results.filter(r => r.matchStatus === 'match').length;
    const discrepancyCount = results.filter(r => r.matchStatus === 'discrepancy').length;
    const clientOnlyCount = results.filter(r => r.matchStatus === 'client_only').length;
    const systemOnlyCount = results.filter(r => r.matchStatus === 'system_only').length;

    this.logger.log(`突合完了: upload=${uploadId}, match=${matchCount}, discrepancy=${discrepancyCount}`);

    return {
      uploadId,
      summary: {
        totalDays: results.length,
        matchCount,
        discrepancyCount,
        clientOnlyCount,
        systemOnlyCount,
      },
      results,
    };
  }

  /** 1日分のレコードを比較 */
  private compareRecords(
    dateStr: string,
    clientRec: any | undefined,
    systemRec: any | undefined,
    config: ReconcileSettings,
  ) {
    const clientStart = clientRec?.startTime || null;
    const clientEnd = clientRec?.endTime || null;
    const clientBreak = clientRec?.breakMinutes ?? null;
    const clientHours = clientRec?.workHours ? Number(clientRec.workHours) : null;

    const systemStart = systemRec?.clockIn ? this.toTimeStr(new Date(systemRec.clockIn)) : null;
    const systemEnd = systemRec?.clockOut ? this.toTimeStr(new Date(systemRec.clockOut)) : null;
    const systemBreak = systemRec?.breakMinutes ?? null;
    const systemHours = systemRec?.workMinutes != null ? Math.round((systemRec.workMinutes / 60) * 100) / 100 : null;

    let matchStatus: string;

    if (!clientRec && systemRec) {
      matchStatus = 'system_only';
    } else if (clientRec && !systemRec) {
      matchStatus = 'client_only';
    } else {
      // 両方存在 → 差異チェック
      // 現場の時刻データがない場合（工数表フォーマット）→ 稼働時間のみで比較
      const hasClientTimes = clientStart != null || clientEnd != null;
      const timeMatch = hasClientTimes
        ? this.isTimeClose(clientStart, systemStart, config.timeToleranceMin)
          && this.isTimeClose(clientEnd, systemEnd, config.timeToleranceMin)
        : true;
      const hoursMatch = clientHours == null || systemHours == null
                       || Math.abs(clientHours - systemHours) <= config.hoursTolerance;

      matchStatus = (timeMatch && hoursMatch) ? 'match' : 'discrepancy';
    }

    // デフォルトで「現場を正」とする
    const resolvedBy = matchStatus === 'system_only' ? 'system' : 'client';
    const resolvedStart = resolvedBy === 'client' ? clientStart : systemStart;
    const resolvedEnd = resolvedBy === 'client' ? clientEnd : systemEnd;
    const resolvedBreak = resolvedBy === 'client' ? clientBreak : systemBreak;
    const resolvedHours = resolvedBy === 'client' ? clientHours : systemHours;

    return {
      date: dateStr,
      matchStatus,
      clientStart,
      clientEnd,
      clientBreak,
      clientHours,
      systemStart,
      systemEnd,
      systemBreak,
      systemHours,
      resolvedBy,
      resolvedStart,
      resolvedEnd,
      resolvedBreak,
      resolvedHours,
    };
  }

  /** 時刻を HH:MM 文字列に変換 */
  private toTimeStr(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** 2つの時刻文字列が許容範囲内か */
  private isTimeClose(a: string | null, b: string | null, toleranceMin: number): boolean {
    if (a == null || b == null) return true; // 片方nullなら比較しない
    const aMin = this.timeStrToMinutes(a);
    const bMin = this.timeStrToMinutes(b);
    return Math.abs(aMin - bMin) <= toleranceMin;
  }

  /** HH:MM → 分 */
  private timeStrToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  /* ======================================
   * 突合完了（確定）
   * ====================================== */

  /**
   * 突合結果を確定し、attendance_confirmed に書き込む
   */
  async confirm(
    uploadId: string,
    confirmerId: string,
    updates?: { date: string; resolvedBy: string; resolvedStart?: string; resolvedEnd?: string; resolvedBreak?: number; resolvedHours?: number }[],
  ) {
    const upload = await this.db.clientAttendanceUpload.findUnique({
      where: { id: uploadId },
    });
    if (!upload) throw new NotFoundException('アップロードデータが見つかりません');
    // 再確定を許可（編集後の再確定フローに対応）

    // 管理者による修正があれば反映
    if (updates?.length) {
      for (const upd of updates) {
        await this.db.reconciliationResult.updateMany({
          where: { uploadId, workDate: new Date(upd.date) },
          data: {
            resolvedBy: upd.resolvedBy,
            resolvedStart: upd.resolvedStart,
            resolvedEnd: upd.resolvedEnd,
            resolvedBreak: upd.resolvedBreak,
            resolvedHours: upd.resolvedHours,
          },
        });
      }
    }

    // 突合結果を取得
    const results = await this.db.reconciliationResult.findMany({
      where: { uploadId },
      orderBy: { workDate: 'asc' },
    });

    const [yearStr, monthStr] = upload.yearMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const now = new Date();

    // 確定データを書き込み（upsert）
    for (const result of results) {
      const startTime = result.resolvedStart
        ? this.timeStrToDate(year, month, new Date(result.workDate).getDate(), result.resolvedStart)
        : null;
      const endTime = result.resolvedEnd
        ? this.timeStrToDate(year, month, new Date(result.workDate).getDate(), result.resolvedEnd)
        : null;

      const breakMin = result.resolvedBreak ?? 60;
      let workMin: number | null = null;
      let overtimeMin: number | null = null;

      if (result.resolvedHours != null) {
        workMin = Math.round(Number(result.resolvedHours) * 60);
        overtimeMin = Math.max(0, workMin - STANDARD_WORK_MINUTES);
      } else if (startTime && endTime) {
        const totalMin = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
        workMin = totalMin - breakMin;
        overtimeMin = Math.max(0, workMin - STANDARD_WORK_MINUTES);
      }

      await this.db.attendanceConfirmed.upsert({
        where: {
          employeeId_workDate: {
            employeeId: upload.employeeId,
            workDate: result.workDate,
          },
        },
        create: {
          employeeId: upload.employeeId,
          workDate: result.workDate,
          startTime,
          endTime,
          breakMinutes: breakMin,
          workMinutes: workMin,
          overtimeMinutes: overtimeMin,
          source: result.resolvedBy === 'client' ? 'client' : result.resolvedBy === 'system' ? 'system' : 'manual',
          confirmedAt: now,
          confirmedBy: confirmerId,
        },
        update: {
          startTime,
          endTime,
          breakMinutes: breakMin,
          workMinutes: workMin,
          overtimeMinutes: overtimeMin,
          source: result.resolvedBy === 'client' ? 'client' : result.resolvedBy === 'system' ? 'system' : 'manual',
          confirmedAt: now,
          confirmedBy: confirmerId,
        },
      });
    }

    // ステータス更新
    await this.db.clientAttendanceUpload.update({
      where: { id: uploadId },
      data: { status: 'confirmed' },
    });

    this.logger.log(`勤怠突合を確定: upload=${uploadId}, confirmedBy=${confirmerId}, records=${results.length}`);

    // Google Drive に保存（非同期・エラー無視）
    this.saveClientAttendanceToGoogleDrive(uploadId, upload.employeeId, year, month, results).catch(e => {
      this.logger.warn(`Google Drive 保存エラー（現場勤怠）: ${(e as Error).message}`);
    });

    return { confirmedCount: results.length };
  }

  /**
   * 現場勤怠確定データを Google Drive に保存
   * アップロードファイルがあればそのまま保存、なければスプレッドシートを生成
   */
  private async saveClientAttendanceToGoogleDrive(
    uploadId: string, employeeId: string, year: number, month: number,
    results: { workDate: Date; resolvedStart: string | null; resolvedEnd: string | null; resolvedBreak: number | null; resolvedHours: any }[],
  ) {
    if (!this.googleDrive.isEnabled()) return;

    const [employee, assignment, upload] = await Promise.all([
      this.db.employee.findUnique({
        where: { id: employeeId },
        select: { lastName: true, firstName: true },
      }),
      this.db.assignment.findFirst({
        where: { employeeId, status: 'active' },
        include: { client: { select: { name: true } } },
      }),
      this.db.clientAttendanceUpload.findUnique({
        where: { id: uploadId },
        select: { filePath: true, fileName: true },
      }),
    ]);

    if (!employee || !results.length) return;

    const empName = `${employee.lastName} ${employee.firstName}`;
    const clientName = assignment?.client?.name || '未アサイン';
    const folders = await this.googleDrive.ensureMonthlyFolders(year, month);

    // アップロードファイルが存在すればそのままDriveに保存
    if (upload?.filePath) {
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.resolve(upload.filePath);

      if (fs.existsSync(fullPath)) {
        const ext = path.extname(upload.fileName || upload.filePath);
        const driveFileName = `${clientName}_${empName}_${year}年${month}月${ext}`;

        const url = await this.googleDrive.uploadFile({
          folderId: folders.clientFolderId,
          fileName: driveFileName,
          filePath: fullPath,
        });

        this.logger.log(`現場勤怠ファイル保存: ${url}`);
        return;
      }
    }

    // フォールバック: アップロードファイルがない場合はスプレッドシートを生成
    const fileName = `${clientName}_${empName}_${year}年${month}月`;
    const fmtMin = (m: number | null) => m != null ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : '';

    const headers = ['日付', '開始', '終了', '休憩(分)', '稼働時間', '残業時間'];
    const rows = results.map(r => {
      const wd = new Date(r.workDate);
      const dateStr = `${wd.getUTCMonth() + 1}/${wd.getUTCDate()}`;
      const breakMin = r.resolvedBreak ?? 60;
      let workMin: number | null = null;
      let overtimeMin: number | null = null;

      if (r.resolvedHours != null) {
        workMin = Math.round(Number(r.resolvedHours) * 60);
        overtimeMin = Math.max(0, workMin - STANDARD_WORK_MINUTES);
      } else if (r.resolvedStart && r.resolvedEnd) {
        const [sh, sm] = r.resolvedStart.split(':').map(Number);
        const [eh, em] = r.resolvedEnd.split(':').map(Number);
        const totalMin = (eh * 60 + em) - (sh * 60 + sm);
        workMin = totalMin - breakMin;
        overtimeMin = Math.max(0, workMin - STANDARD_WORK_MINUTES);
      }

      return [dateStr, r.resolvedStart || '', r.resolvedEnd || '', breakMin, fmtMin(workMin), fmtMin(overtimeMin)];
    });

    const url = await this.googleDrive.saveAttendanceSheet({
      folderId: folders.clientFolderId,
      fileName,
      headers,
      rows,
    });

    this.logger.log(`現場勤怠スプシ保存: ${url}`);
  }

  /** HH:MM → Date に変換 */
  private timeStrToDate(year: number, month: number, day: number, timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, h, m, 0, 0);
  }

  /* ======================================
   * 突合設定
   * ====================================== */

  async getSettings(clientId: string) {
    const settings = await this.db.reconciliationSettings.findUnique({
      where: { clientId },
    });
    return settings || {
      clientId,
      ...DEFAULT_SETTINGS,
      breakIncluded: false,
      roundingUnitMin: 15,
    };
  }

  async updateSettings(clientId: string, data: Partial<ReconcileSettings & { breakIncluded: boolean; roundingUnitMin: number }>) {
    return this.db.reconciliationSettings.upsert({
      where: { clientId },
      create: {
        clientId,
        timeToleranceMin: data.timeToleranceMin ?? 15,
        hoursTolerance: data.hoursTolerance ?? 0.5,
        breakIncluded: data.breakIncluded ?? false,
        roundingUnitMin: data.roundingUnitMin ?? 15,
        defaultStartTime: data.defaultStartTime ?? '09:00',
      },
      update: data,
    });
  }

  /** 社員×年月で突合結果を取得 */
  async getReconcileResultsByEmployee(employeeId: string, yearMonth: string) {
    // confirmed を優先、なければ reconciled
    const upload = await this.db.clientAttendanceUpload.findFirst({
      where: {
        employeeId,
        yearMonth,
        status: { in: ['confirmed', 'reconciled'] },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // confirmed < reconciled (alphabetically)
      include: {
        results: { orderBy: { workDate: 'asc' } },
        client: { select: { name: true } },
      },
    });

    if (!upload) {
      return { uploadId: null, uploadStatus: null, clientName: null, results: [] };
    }

    return {
      uploadId: upload.id,
      uploadStatus: upload.status,
      clientName: upload.client?.name ?? null,
      results: upload.results,
    };
  }

  /** 突合結果を取得（画面表示用） */
  async getReconcileResults(uploadId: string) {
    const upload = await this.db.clientAttendanceUpload.findUnique({
      where: { id: uploadId },
      include: {
        records: { orderBy: { workDate: 'asc' } },
        results: { orderBy: { workDate: 'asc' } },
        employee: { select: { lastName: true, firstName: true, employeeCode: true } },
        client: { select: { name: true } },
      },
    });
    if (!upload) throw new NotFoundException('アップロードデータが見つかりません');
    return upload;
  }
}
