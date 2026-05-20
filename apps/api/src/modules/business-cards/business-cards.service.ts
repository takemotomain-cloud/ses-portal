/**
 * Business Cards Service
 *
 * 名刺スキャン（Claude Vision API）および名刺データ保存。
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export interface ScannedCardData {
  name: string;
  company: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  address: string;
}

@Injectable()
export class BusinessCardsService {
  private readonly logger = new Logger(BusinessCardsService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  /** APIキーを取得（ConfigService → process.env → .envファイル直読み） */
  private getApiKey(): string {
    // 1. ConfigService
    const fromConfig = this.config.get<string>('ANTHROPIC_API_KEY');
    if (fromConfig) return fromConfig;
    // 2. process.env
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    // 3. .envファイル直読み（nest start --watch は dist/ で動くためフォールバック）
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '../../../../.env'),
      path.resolve(__dirname, '../../../.env'),
      path.resolve(__dirname, '../../.env'),
    ];
    for (const p of candidates) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const m = content.match(/ANTHROPIC_API_KEY="([^"]+)"/);
        if (m?.[1]) return m[1];
      } catch { /* ignore */ }
    }
    return '';
  }

  /** Anthropicクライアントを遅延初期化して返す */
  private getClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY が設定されていません。.envファイルにAPIキーを設定してください。');
      }
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic client initialized');
    }
    return this.anthropic;
  }

  /**
   * 名刺画像をClaude Vision APIで解析し、情報を抽出する
   */
  async scanImage(imageBuffer: Buffer, mimeType: string): Promise<ScannedCardData> {
    const client = this.getClient();

    const base64 = imageBuffer.toString('base64');
    const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `この名刺画像から以下の情報をJSON形式で抽出してください。読み取れない項目は空文字にしてください。

{
  "name": "氏名（フルネーム）",
  "company": "会社名",
  "department": "部署名",
  "title": "役職",
  "email": "メールアドレス",
  "phone": "電話番号",
  "address": "住所"
}

JSONのみを返してください。説明やマークダウンは不要です。`,
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      this.logger.log(`OCR raw response: ${text}`);

      // JSONを抽出（コードブロック対応）
      let jsonStr = text.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        name: parsed.name || '',
        company: parsed.company || '',
        department: parsed.department || '',
        title: parsed.title || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        address: parsed.address || '',
      };
    } catch (error: any) {
      this.logger.error(`OCR scan failed: ${error.message}`);
      throw new Error(`名刺の解析に失敗しました: ${error.message}`);
    }
  }

  /**
   * 名刺データをDBに保存する
   */
  async saveCard(data: {
    name: string;
    company: string;
    department?: string;
    title?: string;
    email?: string;
    phone?: string;
    address?: string;
    owner?: string;
    note?: string;
  }, tenantId: string) {
    return this.db.businessCard.create({
      data: {
        tenantId,
        name: data.name,
        company: data.company,
        department: data.department || null,
        title: data.title || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        status: '商談中',
        owner: data.owner || null,
        note: data.note || null,
      },
    });
  }

  /**
   * 名刺（会社）情報を更新する
   */
  async updateCard(id: string, data: {
    name?: string;
    company?: string;
    department?: string;
    title?: string;
    email?: string;
    phone?: string;
    address?: string;
    note?: string;
  }, tenantId: string) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.department !== undefined) updateData.department = data.department || null;
    if (data.title !== undefined) updateData.title = data.title || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.note !== undefined) updateData.note = data.note || null;
    return this.db.businessCard.update({ where: { id, tenantId } as any, data: updateData });
  }

  /**
   * 名刺一覧を取得（商談ログ含む）
   */
  async findAll(params: { search?: string; tenantId: string }) {
    const { tenantId } = params;
    const where: any = { tenantId, deletedAt: null };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { company: { contains: params.search } },
      ];
    }

    return this.db.businessCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { logs: { where: { tenantId }, orderBy: { date: 'asc' } } },
    });
  }

  /**
   * 商談ログを追加
   */
  async addDealLog(data: {
    businessCardId: string;
    date: string;
    content: string;
    contacts?: string;
    recordingUrl?: string;
  }, tenantId: string) {
    return this.db.dealLog.create({
      data: {
        tenantId,
        businessCardId: data.businessCardId,
        date: new Date(data.date),
        content: data.content,
        contacts: data.contacts || null,
        recordingUrl: data.recordingUrl || null,
      },
    });
  }

  /**
   * 商談ログを更新
   */
  async updateDealLog(id: string, data: {
    date?: string;
    content?: string;
    contacts?: string;
    recordingUrl?: string;
  }, tenantId: string) {
    const updateData: any = {};
    if (data.date) updateData.date = new Date(data.date);
    if (data.content !== undefined) updateData.content = data.content;
    if (data.contacts !== undefined) updateData.contacts = data.contacts || null;
    if (data.recordingUrl !== undefined) updateData.recordingUrl = data.recordingUrl || null;
    return this.db.dealLog.update({ where: { id, tenantId } as any, data: updateData });
  }

  /**
   * 商談ログに名刺画像を追加
   */
  async addCardImageToLog(logId: string, imageBuffer: Buffer, tenantId: string): Promise<string> {
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'cards');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `log_${logId}_${Date.now()}.png`;
    const outputPath = path.join(uploadsDir, filename);

    // 名刺領域を検出して切り出し（processAndSaveCardImage と同じロジック）
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width || 1;
    const height = meta.height || 1;

    const binaryBuffer = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .threshold(160)
      .raw()
      .toBuffer();

    const minWhiteRatio = 0.3;
    const margin = Math.floor(Math.min(width, height) * 0.01);

    let top = 0, bottom = height - 1, left = 0, right = width - 1;

    for (let y = 0; y < height; y++) {
      let wc = 0;
      for (let x = 0; x < width; x++) { if (binaryBuffer[y * width + x] > 128) wc++; }
      if (wc / width >= minWhiteRatio) { top = y; break; }
    }
    for (let y = height - 1; y >= 0; y--) {
      let wc = 0;
      for (let x = 0; x < width; x++) { if (binaryBuffer[y * width + x] > 128) wc++; }
      if (wc / width >= minWhiteRatio) { bottom = y; break; }
    }
    for (let x = 0; x < width; x++) {
      let wc = 0;
      for (let y = top; y <= bottom; y++) { if (binaryBuffer[y * width + x] > 128) wc++; }
      if (wc / (bottom - top + 1) >= minWhiteRatio) { left = x; break; }
    }
    for (let x = width - 1; x >= 0; x--) {
      let wc = 0;
      for (let y = top; y <= bottom; y++) { if (binaryBuffer[y * width + x] > 128) wc++; }
      if (wc / (bottom - top + 1) >= minWhiteRatio) { right = x; break; }
    }

    top = Math.min(top + margin, bottom);
    bottom = Math.max(bottom - margin, top);
    left = Math.min(left + margin, right);
    right = Math.max(right - margin, left);

    const cropWidth = Math.max(right - left + 1, 1);
    const cropHeight = Math.max(bottom - top + 1, 1);
    const useFullImage = (cropWidth * cropHeight) < (width * height) * 0.2;

    let pipeline = sharp(imageBuffer);
    if (!useFullImage) {
      pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
    }

    await pipeline
      .normalize()
      .sharpen({ sigma: 1.0 })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ quality: 90 })
      .toFile(outputPath);

    const relativePath = `/uploads/cards/${filename}`;

    // 既存の画像配列に追加
    const log = await this.db.dealLog.findUnique({ where: { id: logId } });
    let images: string[] = [];
    if (log?.cardImages) {
      try { images = JSON.parse(log.cardImages); } catch { /* ignore */ }
    }
    images.push(relativePath);

    await this.db.dealLog.update({
      where: { id: logId, tenantId } as any,
      data: { cardImages: JSON.stringify(images) },
    });

    return relativePath;
  }

  /**
   * 商談ログを削除
   */
  async deleteDealLog(id: string, tenantId: string) {
    return this.db.dealLog.deleteMany({ where: { id, tenantId } });
  }

  /**
   * 名刺画像をスキャン風に加工して保存
   *
   * 処理フロー:
   * 1. 二値化して名刺（白い矩形）領域を検出
   * 2. 行・列の輝度プロファイルから名刺の境界を算出
   * 3. 名刺領域だけを切り出し
   * 4. グレースケール・コントラスト補正・シャープネスで仕上げ
   */
  async processAndSaveCardImage(
    cardId: string,
    imageBuffer: Buffer,
    tenantId: string,
  ): Promise<string> {
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'cards');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${cardId}_${Date.now()}.png`;
    const outputPath = path.join(uploadsDir, filename);

    // Step 1: 元画像のメタデータ取得
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width || 1;
    const height = meta.height || 1;

    // Step 2: 二値化して名刺領域を検出
    // 名刺は白いので、閾値で二値化→白い領域の境界を検出
    const binaryBuffer = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .threshold(160)  // 明るい部分（名刺）を白、暗い部分（背景）を黒に
      .raw()
      .toBuffer();

    // Step 3: 行・列ごとの白ピクセル比率から名刺の境界を算出
    const minWhiteRatio = 0.3; // この比率以上白ピクセルがある行/列を名刺とみなす
    const margin = Math.floor(Math.min(width, height) * 0.01); // 1%のマージン

    // 各行の白ピクセル比率
    let top = 0;
    let bottom = height - 1;
    for (let y = 0; y < height; y++) {
      let whiteCount = 0;
      for (let x = 0; x < width; x++) {
        if (binaryBuffer[y * width + x] > 128) whiteCount++;
      }
      if (whiteCount / width >= minWhiteRatio) {
        top = y;
        break;
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      let whiteCount = 0;
      for (let x = 0; x < width; x++) {
        if (binaryBuffer[y * width + x] > 128) whiteCount++;
      }
      if (whiteCount / width >= minWhiteRatio) {
        bottom = y;
        break;
      }
    }

    // 各列の白ピクセル比率
    let left = 0;
    let right = width - 1;
    for (let x = 0; x < width; x++) {
      let whiteCount = 0;
      for (let y = top; y <= bottom; y++) {
        if (binaryBuffer[y * width + x] > 128) whiteCount++;
      }
      const colHeight = bottom - top + 1;
      if (whiteCount / colHeight >= minWhiteRatio) {
        left = x;
        break;
      }
    }
    for (let x = width - 1; x >= 0; x--) {
      let whiteCount = 0;
      for (let y = top; y <= bottom; y++) {
        if (binaryBuffer[y * width + x] > 128) whiteCount++;
      }
      const colHeight = bottom - top + 1;
      if (whiteCount / colHeight >= minWhiteRatio) {
        right = x;
        break;
      }
    }

    // マージン適用（少し内側に寄せて背景の端を除去）
    top = Math.min(top + margin, bottom);
    bottom = Math.max(bottom - margin, top);
    left = Math.min(left + margin, right);
    right = Math.max(right - margin, left);

    const cropWidth = Math.max(right - left + 1, 1);
    const cropHeight = Math.max(bottom - top + 1, 1);

    // 検出領域が元画像の20%未満なら検出失敗とみなし全体を使用
    const cropArea = cropWidth * cropHeight;
    const totalArea = width * height;
    const useFullImage = cropArea < totalArea * 0.2;

    // Step 4: 切り出し + スキャン風仕上げ
    let pipeline = sharp(imageBuffer);

    if (!useFullImage) {
      pipeline = pipeline.extract({
        left,
        top,
        width: cropWidth,
        height: cropHeight,
      });
    }

    await pipeline
      .normalize()
      .sharpen({ sigma: 1.0 })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ quality: 90 })
      .toFile(outputPath);

    this.logger.log(
      `Card image processed: ${useFullImage ? 'full image' : `crop(${left},${top},${cropWidth}x${cropHeight})`} from ${width}x${height}`,
    );

    const relativePath = `/uploads/cards/${filename}`;

    await this.db.businessCard.update({
      where: { id: cardId, tenantId } as any,
      data: { cardImage: relativePath },
    });

    return relativePath;
  }

  /**
   * R2: 名刺画像を削除
   *
   * BusinessCard.cardImage のパスをクリアし、物理ファイルも削除する。
   */
  async deleteCardImage(cardId: string, tenantId: string): Promise<void> {
    const card = await this.db.businessCard.findUnique({
      where: { id: cardId, tenantId } as any,
      select: { cardImage: true },
    });
    if (!card) {
      throw new Error('名刺が見つかりません');
    }
    if (card.cardImage) {
      const absolute = path.resolve(process.cwd(), '.' + card.cardImage);
      if (fs.existsSync(absolute)) {
        try {
          fs.unlinkSync(absolute);
        } catch (err: any) {
          this.logger.warn(`Card image unlink failed: ${err?.message ?? err}`);
        }
      }
    }
    await this.db.businessCard.update({
      where: { id: cardId, tenantId } as any,
      data: { cardImage: null },
    });
  }

  /**
   * R2: 商談ログの名刺画像を1枚削除
   *
   * dealLog.cardImages (JSON文字列配列) から指定の相対パスを取り除き、
   * 物理ファイルも削除する。
   */
  async deleteLogCardImage(logId: string, imagePath: string, tenantId: string): Promise<void> {
    const log = await this.db.dealLog.findUnique({
      where: { id: logId, tenantId } as any,
      select: { cardImages: true },
    });
    if (!log) throw new Error('商談ログが見つかりません');

    let images: string[] = [];
    if (log.cardImages) {
      try { images = JSON.parse(log.cardImages); } catch { images = []; }
    }

    const normalized = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    const filtered = images.filter(p => p !== normalized);

    if (filtered.length === images.length) {
      throw new Error('指定された画像はログに含まれていません');
    }

    // 物理削除（uploads 配下のみ許可）
    if (normalized.startsWith('/uploads/')) {
      const absolute = path.resolve(process.cwd(), '.' + normalized);
      if (fs.existsSync(absolute)) {
        try {
          fs.unlinkSync(absolute);
        } catch (err: any) {
          this.logger.warn(`Log image unlink failed: ${err?.message ?? err}`);
        }
      }
    }

    await this.db.dealLog.update({
      where: { id: logId, tenantId } as any,
      data: { cardImages: JSON.stringify(filtered) },
    });
  }
}
