/**
 * Dashboard Service — 経営ダッシュボード集計
 *
 * エリア別（東京/大阪/名古屋）の売上・粗利・稼働率・平均単価を集計。
 * assignmentsテーブルのデータからリアルタイム算出。
 *
 * パフォーマンス:
 * - 月次データは変動が少ないためRedisキャッシュ対象（Phase 2で導入）
 * - N+1防止: 1クエリで全アサインを取得→アプリ層で集計
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface AreaStats {
  area: string;
  revenue: number;
  profit: number;
  profitRate: number;
  avgPrice: number;
  activeCount: number;
  totalCount: number;
  utilizationRate: number;
  expiringCount: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * エリア別ダッシュボードデータを集計
   */
  async getAreaDashboard(): Promise<{ areas: AreaStats[]; total: AreaStats }> {
    const assignments = await this.db.assignment.findMany({
      where: { deletedAt: null },
      select: {
        contractPrice: true,
        status: true,
        area: true,
        endDate: true,
        employee: { select: { rewardRate: true } },
      },
    });

    const areaNames = ['tokyo', 'osaka', 'nagoya'];
    const areaLabels: Record<string, string> = { tokyo: '東京エリア', osaka: '大阪エリア', nagoya: '名古屋エリア' };
    const today = new Date();

    const areas: AreaStats[] = areaNames.map(areaCode => {
      const inArea = assignments.filter(a => a.area === areaCode);
      const active = inArea.filter(a => a.status === 'active');
      const standby = inArea.filter(a => a.status === 'standby');

      // 売上 = アクティブなアサインの契約単価合計
      const revenue = active.reduce((s, a) => s + a.contractPrice, 0);

      // 粗利 = 売上 - (売上 × 平均還元率)。還元率分が社員給与。
      const avgRewardRate = active.length > 0
        ? active.reduce((s, a) => s + (Number(a.employee.rewardRate) || 70), 0) / active.length / 100
        : 0.7;
      const profit = Math.round(revenue * (1 - avgRewardRate));

      // 平均単価
      const prices = active.filter(a => a.contractPrice > 0).map(a => a.contractPrice);
      const avgPrice = prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0;

      // 稼働率
      const totalCount = active.length + standby.length;
      const utilizationRate = totalCount > 0 ? Math.round(active.length / totalCount * 1000) / 10 : 0;

      // 30日以内に契約終了
      const expiringCount = active.filter(a => {
        if (!a.endDate) return false;
        const diff = Math.ceil((new Date(a.endDate).getTime() - today.getTime()) / 86400000);
        return diff <= 30 && diff > 0;
      }).length;

      return {
        area: areaLabels[areaCode],
        revenue,
        profit,
        profitRate: revenue > 0 ? Math.round(profit / revenue * 1000) / 10 : 0,
        avgPrice,
        activeCount: active.length,
        totalCount,
        utilizationRate,
        expiringCount,
      };
    });

    // 全体集計
    const total: AreaStats = {
      area: '全体',
      revenue: areas.reduce((s, a) => s + a.revenue, 0),
      profit: areas.reduce((s, a) => s + a.profit, 0),
      profitRate: 0,
      avgPrice: 0,
      activeCount: areas.reduce((s, a) => s + a.activeCount, 0),
      totalCount: areas.reduce((s, a) => s + a.totalCount, 0),
      utilizationRate: 0,
      expiringCount: areas.reduce((s, a) => s + a.expiringCount, 0),
    };
    total.profitRate = total.revenue > 0 ? Math.round(total.profit / total.revenue * 1000) / 10 : 0;
    const allPrices = assignments.filter(a => a.status === 'active' && a.contractPrice > 0).map(a => a.contractPrice);
    total.avgPrice = allPrices.length > 0 ? Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length) : 0;
    total.utilizationRate = total.totalCount > 0 ? Math.round(total.activeCount / total.totalCount * 1000) / 10 : 0;

    return { areas, total };
  }
}
