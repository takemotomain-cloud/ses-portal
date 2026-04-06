/**
 * gBizINFO API Service
 *
 * 経産省の法人情報API（gBizINFO）から企業情報を取得する。
 * API仕様: https://info.gbiz.go.jp/hojin/swagger-ui.html
 *
 * 必要な環境変数: GBIZINFO_API_TOKEN
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GBizCompanyInfo {
  corporateNumber: string;
  name: string;
  kana: string;
  location: string;
  postalCode: string;
  representativeName: string;
  capitalStock: string;
  companyUrl: string;
  employeeNumber: string;
  updateDate: string;
}

@Injectable()
export class GBizInfoService {
  private readonly logger = new Logger(GBizInfoService.name);
  private readonly baseUrl = 'https://info.gbiz.go.jp/hojin/v1/hojin';

  constructor(private readonly config: ConfigService) {}

  private getToken(): string {
    return this.config.get<string>('GBIZINFO_API_TOKEN') || process.env.GBIZINFO_API_TOKEN || '';
  }

  /**
   * 会社名で検索
   */
  async searchByName(name: string, limit = 10): Promise<GBizCompanyInfo[]> {
    const token = this.getToken();
    if (!token) {
      this.logger.warn('GBIZINFO_API_TOKEN is not set');
      return [];
    }

    try {
      const url = `${this.baseUrl}?name=${encodeURIComponent(name)}&page=1&limit=${limit}`;
      const res = await fetch(url, {
        headers: { 'X-hojinInfo-api-token': token },
      });

      if (!res.ok) {
        this.logger.error(`gBizINFO API error: ${res.status}`);
        return [];
      }

      const data = await res.json();
      const infos = data['hojin-infos'] || [];

      return infos.map((h: any) => this.mapToInfo(h));
    } catch (err: any) {
      this.logger.error(`gBizINFO search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * 法人番号で取得
   */
  async getByCorpNumber(corpNumber: string): Promise<GBizCompanyInfo | null> {
    const token = this.getToken();
    if (!token) {
      this.logger.warn('GBIZINFO_API_TOKEN is not set');
      return null;
    }

    try {
      const url = `${this.baseUrl}/${corpNumber}`;
      const res = await fetch(url, {
        headers: { 'X-hojinInfo-api-token': token },
      });

      if (!res.ok) {
        this.logger.error(`gBizINFO API error: ${res.status}`);
        return null;
      }

      const data = await res.json();
      const infos = data['hojin-infos'] || [];
      if (infos.length === 0) return null;

      return this.mapToInfo(infos[0]);
    } catch (err: any) {
      this.logger.error(`gBizINFO fetch failed: ${err.message}`);
      return null;
    }
  }

  private mapToInfo(h: any): GBizCompanyInfo {
    return {
      corporateNumber: h.corporate_number || '',
      name: h.name || '',
      kana: h.kana || '',
      location: h.location || '',
      postalCode: h.postal_code || '',
      representativeName: h.representative_name || '',
      capitalStock: h.capital_stock ? String(h.capital_stock) : '',
      companyUrl: h.company_url || '',
      employeeNumber: h.employee_number ? String(h.employee_number) : '',
      updateDate: h.update_date || '',
    };
  }
}
