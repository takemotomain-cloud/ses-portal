/**
 * PdfService — HTML から PDF（A4）を生成する共通サービス
 *
 * Puppeteer (Chromium) を使い、各書類モジュールから HTML 文字列を渡されたら
 * Buffer を返す。Chromium が無い環境では例外を投げるので呼び出し側は
 * try-catch で耐性を持たせること（スキルシート発行と同じ方針）。
 */

import { Injectable, Logger } from '@nestjs/common';

export interface PdfOptions {
  /** A4 余白 (mm)。デフォルト top/bottom 20mm, left/right 15mm */
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
  /** 用紙サイズ（デフォルト A4） */
  format?: 'A4' | 'A3' | 'Letter';
  /** 背景色や画像を出力するか（デフォルト true） */
  printBackground?: boolean;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * HTML 文字列を PDF Buffer に変換する
   */
  async generatePdfFromHtml(html: string, options: PdfOptions = {}): Promise<Buffer> {
    // Puppeteer を動的 require（Chromium 未インストール環境の起動失敗を遅延）
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
        format: options.format || 'A4',
        printBackground: options.printBackground ?? true,
        margin: {
          top: options.margin?.top || '20mm',
          bottom: options.margin?.bottom || '20mm',
          left: options.margin?.left || '15mm',
          right: options.margin?.right || '15mm',
        },
      });
      return Buffer.from(pdf);
    } catch (e) {
      this.logger.error('PDF 生成失敗', e);
      throw e;
    } finally {
      if (browser) {
        try { await browser.close(); } catch { /* noop */ }
      }
    }
  }

  /**
   * HTML エスケープ用ユーティリティ（書類テンプレ共通）
   */
  static esc(s: any): string {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br/>');
  }
}
