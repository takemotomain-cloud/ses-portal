/**
 * 有給休暇ツール
 *
 * - get_leave_balance: 有給残日数を確認
 * - create_leave_request: 有給を申請
 * - approve_leave: 有給申請を承認（残日数FIFO自動消化）
 * - reject_leave: 有給申請を却下
 * - list_pending_leaves: 承認待ちの有給申請一覧
 *
 * 使用例:
 *   「山田太郎の有給残日数は？」
 *   「佐藤健太の有給申請を承認して」
 *   「承認待ちの有給申請を見せて」
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../utils/api-client';

export function registerLeaveTools(server: McpServer) {

  // 有給残日数取得
  server.tool(
    'get_leave_balance',
    '社員の有給残日数を取得する。付与ロットごとの内訳と消滅日も表示。',
    {
      employee_id: z.string().describe('社員ID'),
    },
    async (params) => {
      try {
        const data = await apiRequest('GET', '/leave/balance');

        const lines = [
          `有給残日数: ${data.remaining}日`,
          '',
          '付与ロット内訳:',
          ...data.balances.map((b: any) =>
            `  付与日 ${b.grantedDate} — 付与${b.grantedDays}日 / 消化${b.usedDays}日 / 残${b.remainingDays}日（消滅日: ${b.expiryDate}）`
          ),
        ];

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 有給申請
  server.tool(
    'create_leave_request',
    '有給休暇を申請する。開始日・終了日・種別を指定。',
    {
      employee_id: z.string().describe('社員ID'),
      leave_type: z.enum(['full_day', 'am_half', 'pm_half', 'special']).describe('種別（full_day=全休, am_half=午前半休, pm_half=午後半休, special=特別休暇）'),
      start_date: z.string().describe('開始日（YYYY-MM-DD形式）'),
      end_date: z.string().describe('終了日（YYYY-MM-DD形式）'),
      days: z.number().describe('取得日数（半休は0.5）'),
      reason: z.string().optional().describe('事由'),
    },
    async (params) => {
      try {
        const result = await apiRequest('POST', '/leave/request', {
          leaveType: params.leave_type,
          startDate: params.start_date,
          endDate: params.end_date,
          days: params.days,
          reason: params.reason,
        });

        const typeLabels: Record<string, string> = {
          full_day: '全休', am_half: '午前半休', pm_half: '午後半休', special: '特別休暇',
        };

        return { content: [{ type: 'text', text:
          `有給申請を提出しました。\n` +
          `種別: ${typeLabels[params.leave_type]}\n` +
          `期間: ${params.start_date} 〜 ${params.end_date}（${params.days}日）\n` +
          `ステータス: 承認待ち`
        }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 承認待ち一覧
  server.tool(
    'list_pending_leaves',
    '承認待ちの有給申請一覧を取得する。管理者専用。',
    {},
    async () => {
      try {
        const data = await apiRequest('GET', '/leave/pending');

        if (!data || data.length === 0) {
          return { content: [{ type: 'text', text: '承認待ちの有給申請はありません。' }] };
        }

        const lines = data.map((r: any) =>
          `・${r.employee.lastName} ${r.employee.firstName}（${r.employee.employeeCode}）\n  ${r.startDate} 〜 ${r.endDate}（${r.days}日）ID: ${r.id}`
        );

        return { content: [{ type: 'text', text: `承認待ちの有給申請 ${data.length}件:\n\n${lines.join('\n\n')}` }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 有給申請を承認
  server.tool(
    'approve_leave',
    '有給申請を承認する。承認すると有給残日数が自動的に減算される（先入先出方式）。',
    {
      request_id: z.string().describe('有給申請のID'),
    },
    async (params) => {
      try {
        await apiRequest('POST', `/leave/${params.request_id}/approve`);
        return { content: [{ type: 'text', text: '有給申請を承認しました。残日数が自動的に更新されました。' }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 有給申請を却下
  server.tool(
    'reject_leave',
    '有給申請を却下する。却下理由を任意で指定可能。',
    {
      request_id: z.string().describe('有給申請のID'),
      reason: z.string().optional().describe('却下理由'),
    },
    async (params) => {
      try {
        await apiRequest('POST', `/leave/${params.request_id}/reject`, {
          reason: params.reason,
        });
        return { content: [{ type: 'text', text: '有給申請を却下しました。' }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );
}
