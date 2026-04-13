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
  private enabled = false;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      this.logger.warn('GOOGLE_OAUTH_CLIENT_ID/SECRET が未設定 — Google Drive 連携は無効');
      return;
    }

    this.oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // DBから保存済みトークンを読み込み
    const token = await this.db.integrationToken.findUnique({
      where: { provider: 'google_drive' },
    });

    if (token) {
      this.oauth2.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expiry_date: token.expiresAt.getTime(),
      });
      this.initClients();
      this.logger.log(`Google Drive 連携済み（${token.email}）`);
    } else {
      this.logger.log('Google Drive 未連携 — 管理画面から連携してください');
    }
  }

  /** Drive/Sheets クライアントを初期化 */
  private initClients() {
    this.drive = google.drive({ version: 'v3', auth: this.oauth2 });
    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2 });
    this.enabled = true;
  }

  /** Google Drive 連携が有効か */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ================================================================
  // OAuth フロー
  // ================================================================

  /** OAuth認証URLを生成 */
  getAuthorizationUrl(): string {
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });
  }

  /** 認証コードからトークンを取得してDB保存 */
  async handleCallback(code: string): Promise<{ email: string }> {
    const { tokens } = await this.oauth2.getToken(code);
    this.oauth2.setCredentials(tokens);

    // メールアドレス取得
    const oauth2Api = google.oauth2({ version: 'v2', auth: this.oauth2 });
    const userInfo = await oauth2Api.userinfo.get();
    const email = userInfo.data.email || '';

    // DB保存（upsert）
    await this.db.integrationToken.upsert({
      where: { provider: 'google_drive' },
      create: {
        provider: 'google_drive',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
    });

    this.initClients();
    this.logger.log(`Google Drive 連携完了: ${email}`);

    return { email };
  }

  /** 連携解除 */
  async disconnect(): Promise<void> {
    await this.db.integrationToken.deleteMany({
      where: { provider: 'google_drive' },
    });
    this.enabled = false;
    this.rootFolderId = null;
    this.logger.log('Google Drive 連携を解除しました');
  }

  /** 連携状態を取得 */
  async getStatus(): Promise<{ connected: boolean; email?: string }> {
    const token = await this.db.integrationToken.findUnique({
      where: { provider: 'google_drive' },
    });
    if (!token) return { connected: false };
    return { connected: true, email: token.email || undefined };
  }

  /** APIコール前にトークンを自動更新 */
  private async refreshTokenIfNeeded() {
    if (!this.enabled) return;

    const creds = this.oauth2.credentials;
    if (creds.expiry_date && creds.expiry_date > Date.now() + 60000) return;

    try {
      const { credentials } = await this.oauth2.refreshAccessToken();
      this.oauth2.setCredentials(credentials);

      await this.db.integrationToken.update({
        where: { provider: 'google_drive' },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: new Date(credentials.expiry_date!),
        },
      });
      this.logger.log('アクセストークンを更新しました');
    } catch (e) {
      this.logger.error('トークン更新エラー', e);
      this.enabled = false;
    }
  }

  // ================================================================
  // フォルダ操作
  // ================================================================

  /**
   * 指定の親フォルダ内に名前のフォルダを作成（既にあればそのIDを返す）
   */
  async ensureFolder(parentId: string | null, name: string): Promise<string> {
    await this.refreshTokenIfNeeded();

    const query = parentId
      ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;

    const res = await this.drive.files.list({ q: query, fields: 'files(id)' });
    if (res.data.files?.length) {
      return res.data.files[0].id!;
    }

    const created = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      },
      fields: 'id',
    });

    this.logger.log(`フォルダ作成: ${name} (${created.data.id})`);
    return created.data.id!;
  }

  /**
   * 月次フォルダ構成を確保して返す
   */
  async ensureMonthlyFolders(year: number, month: number) {
    if (!this.enabled) {
      throw new Error('Google Drive 連携が無効です');
    }

    // ルートフォルダを確保（初回のみ作成）
    if (!this.rootFolderId) {
      this.rootFolderId = await this.ensureFolder(null, 'SESポータル勤怠');
    }

    const monthFolder = await this.ensureFolder(
      this.rootFolderId,
      `${year}年${month}月_勤怠表`,
    );
    const selfFolder = await this.ensureFolder(monthFolder, '本人勤怠');
    const clientFolder = await this.ensureFolder(monthFolder, '現場勤怠');

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
  async uploadFile(params: {
    folderId: string;
    fileName: string;
    filePath: string;
    mimeType?: string;
  }): Promise<string> {
    await this.refreshTokenIfNeeded();

    const { folderId, fileName, filePath } = params;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = params.mimeType || GoogleDriveService.MIME_MAP[ext] || 'application/octet-stream';

    // 同名ファイルを検索（再確定時の上書き対応）
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const existing = await this.drive.files.list({ q: query, fields: 'files(id)' });

    let fileId: string;

    if (existing.data.files?.length) {
      // 既存ファイルを上書き
      fileId = existing.data.files[0].id!;
      await this.drive.files.update({
        fileId,
        media: {
          mimeType,
          body: fs.createReadStream(filePath),
        },
      });
      this.logger.log(`既存ファイルを上書き: ${fileName} (${fileId})`);
    } else {
      // 新規作成
      const created = await this.drive.files.create({
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
      this.logger.log(`ファイルアップロード: ${fileName} (${fileId})`);
    }

    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  // ================================================================
  // スプレッドシート操作
  // ================================================================

  /**
   * スプレッドシートを作成 or 上書き
   */
  async saveAttendanceSheet(params: {
    folderId: string;
    fileName: string;
    headers: string[];
    rows: (string | number | null)[][];
  }): Promise<string> {
    await this.refreshTokenIfNeeded();

    const { folderId, fileName, headers, rows } = params;

    // 既存ファイル検索
    const query = `name='${fileName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const existing = await this.drive.files.list({ q: query, fields: 'files(id)' });

    let spreadsheetId: string;

    if (existing.data.files?.length) {
      // 既存ファイルのデータを上書き
      spreadsheetId = existing.data.files[0].id!;
      this.logger.log(`既存スプシを上書き: ${fileName} (${spreadsheetId})`);

      const meta = await this.sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
      const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetTitle,
      });
    } else {
      // 新規作成（Drive APIで作成 — OAuthユーザーがオーナー）
      const created = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId],
        },
        fields: 'id',
      });
      spreadsheetId = created.data.id!;

      this.logger.log(`新規スプシ作成: ${fileName} (${spreadsheetId})`);
    }

    // シート名を取得してデータ書き込み
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
    const values = [headers, ...rows];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    // ヘッダー行を太字にする
    await this.sheets.spreadsheets.batchUpdate({
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
