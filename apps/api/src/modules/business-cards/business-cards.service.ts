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
        model: 'claude-sonnet-4-20250514',
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
  }) {
    return this.db.businessCard.create({
      data: {
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
   * 名刺一覧を取得（商談ログ含む）
   */
  async findAll(params: { search?: string }) {
    const where: any = { deletedAt: null };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { company: { contains: params.search } },
      ];
    }

    return this.db.businessCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { logs: { orderBy: { date: 'asc' } } },
    });
  }

  /**
   * 商談ログを追加
   */
  async addDealLog(data: {
    businessCardId: string;
    date: string;
    content: string;
    recordingUrl?: string;
  }) {
    return this.db.dealLog.create({
      data: {
        businessCardId: data.businessCardId,
        date: new Date(data.date),
        content: data.content,
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
    recordingUrl?: string;
  }) {
    const updateData: any = {};
    if (data.date) updateData.date = new Date(data.date);
    if (data.content !== undefined) updateData.content = data.content;
    if (data.recordingUrl !== undefined) updateData.recordingUrl = data.recordingUrl || null;
    return this.db.dealLog.update({ where: { id }, data: updateData });
  }

  /**
   * 商談ログを削除
   */
  async deleteDealLog(id: string) {
    return this.db.dealLog.delete({ where: { id } });
  }

  /**
   * 名刺画像をスキャン風に加工して保存
   * - グレースケール化
   * - コントラスト・シャープネス向上
   * - 余白トリミング（trim）
   * - 白背景正規化
   */
  async processAndSaveCardImage(
    cardId: string,
    imageBuffer: Buffer,
  ): Promise<string> {
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'cards');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${cardId}_${Date.now()}.png`;
    const outputPath = path.join(uploadsDir, filename);

    await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .linear(1.3, -(128 * 1.3 - 128))  // コントラスト強調
      .trim()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ quality: 90 })
      .toFile(outputPath);

    const relativePath = `/uploads/cards/${filename}`;

    await this.db.businessCard.update({
      where: { id: cardId },
      data: { cardImage: relativePath },
    });

    return relativePath;
  }
}
