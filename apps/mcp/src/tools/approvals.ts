/**
 * 承認ツール
 *
 * - list_pending_approvals: 全承認待ち一覧（有給・経費・情報変更を統合）
 * - approve_request: 申請を承認
 * - reject_request: 申請を却下
 *
 * 使用例:
 *   「承認待ちの申請を全部見せて」
 *   「山田太郎の有給申請を承認して」
 *   「経費申請を全部まとめて承認して」
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest, formatCurrency } from '../utils/api-client';

export function registerApprovalTools(server: McpServer) {

  // 全承認待ち一覧
  server.tool(
    'list_pending_approvals',
    '承認待ちの全申請一覧を取得する。有給・経費・情報変更を種別ごとに表示。管理者専用。',
    {},
    async () => {
      try {
        // 有給の承認待ち
        const leaveData = await apiRequest('GET', '/leave/pending');
        
        const sections: string[] = [];

        // 有給申請
        if (leaveData && leaveData.length > 0) {
          sections.push(`📋 有給申請（${leaveData.length}件）`);
          leaveData.forEach((r: any) => {
            sections.push(`  ・${r.employee.lastName} ${r.employee.firstName}: ${r.startDate}〜${r.endDate}（${r.days}日）[ID: ${r.id}]`);
          });
        } else {
          sections.push('📋 有給申請: 承認待ちなし');
        }

        // 経費・情報変更は管理側APIから取得（Phase 2以降で実装）
        sections.push('');
        sections.push('💰 経費精算: 管理画面で確認してください');
        sections.push('📝 情報変更: 管理画面で確認してください');

        const total = (leaveData?.length || 0);
        const header = `承認待ち合計: ${total}件\n\n`;

        return { content: [{ type: 'text', text: header + sections.join('\n') }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 申請を承認（汎用）
  server.tool(
    'approve_request',
    '申請を承認する。有給申請の場合は残日数が自動減算される。',
    {
      request_type: z.enum(['leave', 'expense', 'change']).describe('申請種別（leave=有給, expense=経費, change=情報変更）'),
      request_id: z.string().describe('申請ID'),
    },
    async (params) => {
      try {
        const typeLabels: Record<string, string> = { leave: '有給申請', expense: '経費申請', change: '情報変更' };
        
        if (params.request_type === 'leave') {
          await apiRequest('POST', `/leave/${params.request_id}/approve`);
        } else {
          // Phase 2以降で経費・情報変更の承認APIを追加
          return { content: [{ type: 'text', text: `${typeLabels[params.request_type]}の承認APIは管理画面から実行してください。` }] };
        }

        return { content: [{ type: 'text', text: `${typeLabels[params.request_type]}を承認しました。` }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 申請を却下（汎用）
  server.tool(
    'reject_request',
    '申請を却下する。却下理由を指定可能。',
    {
      request_type: z.enum(['leave', 'expense', 'change']).describe('申請種別'),
      request_id: z.string().describe('申請ID'),
      reason: z.string().optional().describe('却下理由'),
    },
    async (params) => {
      try {
        const typeLabels: Record<string, string> = { leave: '有給申請', expense: '経費申請', change: '情報変更' };
        
        if (params.request_type === 'leave') {
          await apiRequest('POST', `/leave/${params.request_id}/reject`, {
            reason: params.reason,
          });
        } else {
          return { content: [{ type: 'text', text: `${typeLabels[params.request_type]}の却下APIは管理画面から実行してください。` }] };
        }

        return { content: [{ type: 'text', text: `${typeLabels[params.request_type]}を却下しました。` }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );
}
