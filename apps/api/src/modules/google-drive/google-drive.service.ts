/**
 * Google Drive / Sheets サービス（OAuth 2.0 版）
 *
 * 管理者がOAuth認証で連携 → リフレッシュトークンをDBに保存 →
 * 以降は管理者のDriveストレージにスプレッドシートを自動作成。
 *
 * 環境変数:
 *   GOOGLE_OAUTH_CLIENT_ID — OAuthクライアントID
 *   GOOGLE_OAUTH_CLIENT_SECRET — OAuthクライアントシークレット
 *   GOOGLE_OAUTH_REDIRECT_URI — コールバックURL
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, drive_v3, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../database/database.service';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];

@Injectable()
export class GoogleDriveService implements OnModuleInit {
  private readonly logger = new Logger(GoogleDriveService.name);
  private oauth2!: InstanceType<typeof google.auth.OAuth2>;
  private drive!: drive_v3.Drive;
  private sheets!: sheets_v4.Sheets;
  private rootFolderId: string | null = null;
  private rootFolderPath: string | null = null;
  private enabled = false;
  /** ensureFolderPath のキャッシュ（同一プロセス内で folder ID を再検索しない） */
  private folderPathCache = new Map<string, string>();
  private clientId?: string;
  private clientSecret?: string;
  private redirectUri?: string;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    this.clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('GOOGLE_OAUTH_CLIENT_ID/SECRET が未設定 — Google Drive 連携は無効');
      return;
    }
  }
    }
  }

  private createOAuth2Client() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  private async getClients(tenantId: string) {
    const token = await this.db.integrationToken.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
    });
    if (!token) {
      throw new Error(`Google Drive not connected for tenant ${tenantId}`);
    }

    const oauth2 = this.createOAuth2Client();
    oauth2.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken || undefined,
      expiry_date: token.expiresAt.getTime(),
    });

    // リフレッシュ
    if (oauth2.credentials.expiry_date && oauth2.credentials.expiry_date < Date.now() + 60000) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      await this.db.integrationToken.update({
        where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: new Date(credentials.expiry_date!),
        },
      });
    }

    return {
      oauth2,
      drive: google.drive({ version: 'v3', auth: oauth2 }),
      sheets: google.sheets({ version: 'v4', auth: oauth2 }),
    };
  }

  /** Google Drive 連携が有効か */
  async isEnabled(tenantId: string): Promise<boolean> {
    const token = await this.db.integrationToken.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
    });
    return !!token;
  }

  // ================================================================
  // OAuth フロー
  // ================================================================

  /** OAuth認証URLを生成 */
  getAuthorizationUrl(tenantId: string): string {
    const oauth2 = this.createOAuth2Client();
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: tenantId,
    });
  }

  /** 認証コードからトークンを取得してDB保存 */
  async handleCallback(code: string, tenantId: string): Promise<{ email: string; subdomain: string }> {
    const oauth2 = this.createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // メールアドレス取得
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const userInfo = await oauth2Api.userinfo.get();
    const email = userInfo.data.email || '';

    // DB保存（upsert）
    await this.db.integrationToken.upsert({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
      create: {
        tenantId,
        provider: 'google_drive',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt: new Date(tokens.expiry_date!),
        email,
        rootFolderPath: 'SES Portal',
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
    });

    this.logger.log(`Google Drive 連携完了 (tenant=${tenantId}): ${email}`);

    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true },
    });

    return { email, subdomain: tenant?.subdomain || '' };
  }

  /** 連携解除 */
  async disconnect(tenantId: string): Promise<void> {
    await this.db.integrationToken.deleteMany({
      where: { tenantId, provider: 'google_drive' },
    });
    this.logger.log(`Google Drive 連携を解除しました (tenant=${tenantId})`);
  }

  /** 連携状態を取得 */
  async getStatus(tenantId: string): Promise<{ connected: boolean; email?: string; rootFolderPath?: string }> {
    const token = await this.db.integrationToken.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
    });
    if (!token) return { connected: false };
    return {
      connected: true,
      email: token.email || undefined,
      rootFolderPath: token.rootFolderPath || 'SES Portal',
    };
  }

  async setRootFolderPath(tenantId: string, pathValue: string): Promise<{ rootFolderPath: string }> {
    const normalized = pathValue
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join('/');

    if (!normalized) {
      throw new Error('保存ルートフォルダを入力してください');
    }
    const enabled = await this.isEnabled(tenantId);
    if (!enabled) {
      throw new Error('Google Drive が連携されていません');
    }

    const folderId = await this.ensureFolderPathFromDriveRoot(tenantId, normalized.split('/'));
    await this.db.integrationToken.update({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
      data: {
        rootFolderId: folderId,
        rootFolderPath: normalized,
      },
    });

    return { rootFolderPath: normalized };
  }

  // refreshTokenIfNeeded は getClients に統合

  // ================================================================
  // フォルダ操作
  // ================================================================

  /**
   * 指定の親フォルダ内に名前のフォルダを作成（既にあればそのIDを返す）
   */
  async ensureFolder(tenantId: string, parentId: string | null, name: string): Promise<string> {
    const { drive } = await this.getClients(tenantId);

    const query = parentId
      ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;

    const res = await drive.files.list({ q: query, fields: 'files(id)' });
    if (res.data.files?.length) {
      return res.data.files[0].id!;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      },
      fields: 'id',
    });

    this.logger.log(`フォルダ作成 (tenant=${tenantId}): ${name} (${created.data.id})`);
    return created.data.id!;
  }

  /**
   * ルート (SES Portal) フォルダ ID を確保
   */
  private async getRootFolderId(tenantId: string): Promise<string> {
    const token = await this.db.integrationToken.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
    });
    if (token?.rootFolderId) {
      return token.rootFolderId;
    }
    const segments = (token?.rootFolderPath || 'SES Portal')
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const rootFolderId = await this.ensureFolderPathFromDriveRoot(tenantId, segments);
    
    // DBにキャッシュ
    await this.db.integrationToken.update({
      where: { tenantId_provider: { tenantId, provider: 'google_drive' } },
      data: { rootFolderId },
    });
    
    return rootFolderId;
  }

  private async ensureFolderPathFromDriveRoot(tenantId: string, segments: string[]): Promise<string> {
    let parentId: string | null = null;
    for (const seg of segments) {
      parentId = await this.ensureFolder(tenantId, parentId, seg);
    }
    if (!parentId) {
      throw new Error('保存ルートフォルダを作成できませんでした');
    }
    return parentId;
  }

  /**
   * 任意の階層パスを順に作成・確保し、最深部のフォルダIDを返す
   * 例: ensureFolderPath(tenantId, ['2026年度', '2026年5月', '給与明細'])
   */
  async ensureFolderPath(tenantId: string, segments: string[]): Promise<string> {
    let parentId = await this.getRootFolderId(tenantId);
    for (const seg of segments) {
      parentId = await this.ensureFolder(tenantId, parentId, seg);
    }
    return parentId;
  }

  /**
   * 5月始まり年度ラベルを返す。例: 2026/4 → "2025年度", 2026/5 → "2026年度"
   */
  getFiscalYearLabel(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    return `${m >= 5 ? y : y - 1}年度`;
  }

  /**
   * 月ラベルを返す。例: 2026/5 → "2026年5月"
   */
  getMonthLabel(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }

  /**
   * 書類PDFを Drive に保存する高レベルAPI
   *
   * 階層: SES Portal/{年度}/{YYYY年M月}/{categoryFolder}/
   *
   * @param opts.fiscalYearDate 年度判定に使う日付（給与明細は対象月、他は発行日）
   * @param opts.monthDate     月フォルダ判定に使う日付（給与明細は対象月、他は発行日）
   * @param opts.categoryFolder 書類カテゴリフォルダ名（例: '給与明細', '内定通知書'）
   * @param opts.fileName      ファイル名（拡張子含む）
   * @param opts.pdf           PDF Buffer
   */
  async saveDocumentPdf(tenantId: string, opts: {
    categoryFolder: string;
    fiscalYearDate: Date;
    monthDate: Date;
    fileName: string;
    pdf: Buffer;
  }): Promise<{ fileId: string; webViewLink: string }> {
    const fiscalLabel = this.getFiscalYearLabel(opts.fiscalYearDate);
    const monthLabel = this.getMonthLabel(opts.monthDate);
    const folderId = await this.ensureFolderPath(tenantId, [fiscalLabel, monthLabel, opts.categoryFolder]);

    return this.uploadBuffer(tenantId, {
      folderId,
      fileName: opts.fileName,
      buffer: opts.pdf,
      mimeType: 'application/pdf',
    });
  }

  /**
   * Buffer をそのまま Drive にアップロード（同名は上書き）
   */
  async uploadBuffer(tenantId: string, params: {
    folderId: string;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<{ fileId: string; webViewLink: string }> {
    const { drive } = await this.getClients(tenantId);
    const { folderId, fileName, buffer, mimeType } = params;
    const { Readable } = await import('stream');

    const query = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
    const existing = await drive.files.list({ q: query, fields: 'files(id)' });

    let fileId: string;
    if (existing.data.files?.length) {
      fileId = existing.data.files[0].id!;
      await drive.files.update({
        fileId,
        media: { mimeType, body: Readable.from(buffer) },
      });
      this.logger.log(`Drive 上書き (tenant=${tenantId}): ${fileName} (${fileId})`);
    } else {
      const created = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType, body: Readable.from(buffer) },
        fields: 'id',
      });
      fileId = created.data.id!;
      this.logger.log(`Drive 新規 (tenant=${tenantId}): ${fileName} (${fileId})`);
    }

    return { fileId, webViewLink: `https://drive.google.com/file/d/${fileId}/view` };
  }

  /**
   * 月次フォルダ構成を確保して返す（旧API・後方互換のため残置）
   * 新しいコードでは ensureFolderPath を使うこと
   */
  async ensureMonthlyFolders(tenantId: string, year: number, month: number) {
    // 新フォルダ構成: SES Portal/{年度}/{YYYY年M月}/勤怠/本人勤怠 (および 現場勤怠)
    const targetDate = new Date(year, month - 1, 1);
    const fiscalLabel = this.getFiscalYearLabel(targetDate);
    const monthLabel = this.getMonthLabel(targetDate);

    const selfFolder = await this.ensureFolderPath(tenantId, [fiscalLabel, monthLabel, '勤怠', '本人勤怠']);
    const clientFolder = await this.ensureFolderPath(tenantId, [fiscalLabel, monthLabel, '勤怠', '現場勤怠']);

    return { selfFolderId: selfFolder, clientFolderId: clientFolder };
  }

  // ================================================================
  // ファイルアップロード（元ファイルをそのまま保存）
  // ================================================================

  /** 拡張子 → MIMEタイプ のマッピング */
  private static readonly MIME_MAP: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  /**
   * ローカルファイルをそのままGoogle Driveにアップロード（再確定時は上書き）
   */
  async uploadFile(tenantId: string, params: {
    folderId: string;
    fileName: string;
    filePath: string;
    mimeType?: string;
  }): Promise<string> {
    const { drive } = await this.getClients(tenantId);

    const { folderId, fileName, filePath } = params;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = params.mimeType || GoogleDriveService.MIME_MAP[ext] || 'application/octet-stream';

    // 同名ファイルを検索（再確定時の上書き対応）
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const existing = await drive.files.list({ q: query, fields: 'files(id)' });

    let fileId: string;

    if (existing.data.files?.length) {
      // 既存ファイルを上書き
      fileId = existing.data.files[0].id!;
      await drive.files.update({
        fileId,
        media: {
          mimeType,
          body: fs.createReadStream(filePath),
        },
      });
      this.logger.log(`既存ファイルを上書き (tenant=${tenantId}): ${fileName} (${fileId})`);
    } else {
      // 新規作成
      const created = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType,
          body: fs.createReadStream(filePath),
        },
        fields: 'id',
      });
      fileId = created.data.id!;
      this.logger.log(`ファイルアップロード (tenant=${tenantId}): ${fileName} (${fileId})`);
    }

    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  // ================================================================
  // スプレッドシート操作
  // ================================================================

  /**
   * スプレッドシートを作成 or 上書き
   */
  async saveAttendanceSheet(tenantId: string, params: {
    folderId: string;
    fileName: string;
    headers: string[];
    rows: (string | number | null)[][];
  }): Promise<string> {
    const { drive, sheets } = await this.getClients(tenantId);

    const { folderId, fileName, headers, rows } = params;

    // 既存ファイル検索
    const query = `name='${fileName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const existing = await drive.files.list({ q: query, fields: 'files(id)' });

    let spreadsheetId: string;

    if (existing.data.files?.length) {
      // 既存ファイルのデータを上書き
      spreadsheetId = existing.data.files[0].id!;
      this.logger.log(`既存スプシを上書き (tenant=${tenantId}): ${fileName} (${spreadsheetId})`);

      const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
      const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetTitle,
      });
    } else {
      // 新規作成（Drive APIで作成 — OAuthユーザーがオーナー）
      const created = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId],
        },
        fields: 'id',
      });
      spreadsheetId = created.data.id!;

      this.logger.log(`新規スプシ作成 (tenant=${tenantId}): ${fileName} (${spreadsheetId})`);
    }

    // シート名を取得してデータ書き込み
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
    const values = [headers, ...rows];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    // ヘッダー行を太字にする
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        }],
      },
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  }
}
