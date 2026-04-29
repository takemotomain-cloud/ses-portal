/**
 * 稼働管理ツール
 *
 * - get_current_assignment: 現在の稼働先を取得
 * - get_assignment_history: 稼働ヒストリーを取得
 *
 * 使用例:
 *   「山田太郎の今の稼働先は？」
 *   「佐藤健太の稼働ヒストリーを見せて」
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest, formatCurrency } from '../utils/api-client';

export function registerAssignmentTools(server: McpServer) {

  // 現在の稼働先
  server.tool(
    'get_current_assignment',
    '社員の現在の稼働先情報を取得する。クライアント名・案件名・契約単価・精算幅・還元率を返す。',
    {
      employee_id: z.string().describe('社員ID'),
    },
    async (params) => {
      try {
        const data = await apiRequest('GET', '/assignments/current');

        if (!data) {
          return { content: [{ type: 'text', text: '現在の稼働先はありません（待機中）。' }] };
        }

        const info = [
          `🏢 現在の稼働先`,
          `クライアント: ${data.client?.name || '--'}`,
          `案件名: ${data.projectName}`,
          `契約単価: ${formatCurrency(data.contractPrice)}`,
          `精算幅: ${data.settlementLower}h 〜 ${data.settlementUpper}h`,
          `勤務地: ${data.workLocation || '--'}`,
          `契約期間: ${data.startDate} 〜 ${data.endDate || '未定'}`,
          `ステータス: ${data.status}`,
        ];

        return { content: [{ type: 'text', text: info.join('\n') }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 稼働ヒストリー
  server.tool(
    'get_assignment_history',
    '社員の稼働ヒストリー（過去の全アサイン）を取得する。',
    {
      employee_id: z.string().describe('社員ID'),
    },
    async (params) => {
      try {
        const data = await apiRequest('GET', '/assignments/history');

        if (!data || data.length === 0) {
          return { content: [{ type: 'text', text: '稼働ヒストリーはありません。' }] };
        }

        const lines = data.map((a: any) => {
          const status = a.status === 'active' ? '稼働中' : a.status === 'ended' ? '終了' : a.status;
          return `  ${a.client?.name || '--'} / ${a.projectName}\n  ${a.startDate} 〜 ${a.endDate || '継続中'} 単価${formatCurrency(a.contractPrice)}（${status}）`;
        });

        return { content: [{ type: 'text', text: `稼働ヒストリー ${data.length}件:\n\n${lines.join('\n\n')}` }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );
}
