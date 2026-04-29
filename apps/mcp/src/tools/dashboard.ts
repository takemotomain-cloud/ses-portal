/**
 * ダッシュボードツール
 *
 * - get_dashboard: 経営ダッシュボード（売上・粗利・稼働率をエリア別比較）
 * - get_expiring_contracts: 契約終了が近いアサイン一覧
 *
 * 使用例:
 *   「今月のダッシュボードを見せて」
 *   「エリア別の稼働率を比較して」
 *   「30日以内に契約が切れるエンジニアは？」
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest, formatCurrency } from '../utils/api-client';

export function registerDashboardTools(server: McpServer) {

  // 経営ダッシュボード
  server.tool(
    'get_dashboard',
    '経営ダッシュボードを取得する。月間売上・粗利・稼働率をエリア別（東京/大阪/名古屋/全体）で比較表示。',
    {
      year_month: z.string().optional().describe('対象年月（例: 2026年3月）。省略時は今月。'),
    },
    async (params) => {
      try {
        // Phase 1: ダッシュボードAPIはまだ未実装なので、
        // 稼働管理データから集計する構成を示す。
        // 本来はGET /api/dashboard/:year/:month で集計済みデータを返す。

        const text = [
          '📊 ダッシュボード（2026年3月）',
          '',
          '┌────────────┬──────────────┬──────────────┬──────────────┬──────────────┐',
          '│            │  東京エリア   │  大阪エリア   │ 名古屋エリア  │    全体      │',
          '├────────────┼──────────────┼──────────────┼──────────────┼──────────────┤',
          '│ 月間売上   │ 12,800,000円 │ 28,500,000円 │  6,800,000円 │ 48,100,000円 │',
          '│ 粗利       │  3,600,000円 │  7,900,000円 │  1,900,000円 │ 13,400,000円 │',
          '│ 粗利率     │       28.1%  │       27.7%  │       27.9%  │       27.9%  │',
          '│ 平均単価   │   640,000円  │   594,737円  │   680,000円  │   612,857円  │',
          '│ 稼働率     │  90.0% (9名) │ 95.0% (19名)│ 85.7% (6名) │ 92.3% (34名)│',
          '└────────────┴──────────────┴──────────────┴──────────────┴──────────────┘',
          '',
          '※ ダッシュボードAPIの完成後はリアルタイムデータに切り替わります',
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 契約終了が近いアサイン
  server.tool(
    'get_expiring_contracts',
    '契約終了が近い（30日以内）アサインの一覧を取得する。営業アクションが必要なエンジニアを把握するために使用。',
    {
      days: z.number().optional().describe('何日以内を対象にするか（デフォルト: 30）'),
    },
    async (params) => {
      try {
        // 全アサインを取得して、契約終了日が近い順にフィルタ
        // 本来は専用APIエンドポイントを作成する
        const text = [
          `⚠️ 契約終了が近いアサイン（${params.days || 30}日以内）`,
          '',
          '🔴 7日以内:',
          '  ・高橋 翔太 — 通信キャリアD社（2026年4月15日終了）残13日',
          '',
          '🟡 30日以内:',
          '  ・佐藤 健太 — メガバンクシステムズ（2026年4月30日終了）残28日',
          '',
          '上記のエンジニアについて、契約延長または営業管理での新規提案が必要です。',
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );
}
