/**
 * 社員管理ツール
 *
 * Claudeが使える社員関連の操作:
 * - search_employees: 社員を検索する
 * - get_employee: 社員の詳細情報を取得する
 *
 * 使用例（Claudeへの指示）:
 *   「山田太郎の情報を見せて」
 *   「エンジニアリング課の社員一覧」
 *   「契約社員を全員教えて」
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from '../utils/api-client';

export function registerEmployeeTools(server: McpServer) {

  // 社員検索
  server.tool(
    'search_employees',
    '社員を検索する。氏名・社員番号・ステータスで絞り込み可能。',
    {
      query: z.string().optional().describe('氏名または社員番号で検索'),
      status: z.enum(['active', 'leave', 'resigned']).optional().describe('ステータスで絞り込み（active=在籍, leave=休職, resigned=退職）'),
      page: z.number().optional().describe('ページ番号（デフォルト: 1）'),
      limit: z.number().optional().describe('1ページあたりの件数（デフォルト: 20）'),
    },
    async (params) => {
      try {
        const queryParams = new URLSearchParams();
        if (params.query) queryParams.set('search', params.query);
        if (params.status) queryParams.set('status', params.status);
        if (params.page) queryParams.set('page', params.page.toString());
        if (params.limit) queryParams.set('limit', params.limit.toString());

        const result = await apiRequest('GET', `/employees?${queryParams.toString()}`);

        if (!result.data || result.data.length === 0) {
          return { content: [{ type: 'text', text: '該当する社員が見つかりませんでした。' }] };
        }

        const lines = result.data.map((e: any) =>
          `・${e.employeeCode} ${e.lastName} ${e.firstName}（${e.departmentName}・${e.employmentType === 'regular' ? '正社員' : '契約社員'}・${e.status === 'active' ? '在籍' : e.status === 'leave' ? '休職' : '退職'}）`
        );

        const text = `社員一覧（${result.total}名中 ${result.data.length}名表示）\n\n${lines.join('\n')}`;

        return { content: [{ type: 'text', text }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 社員詳細取得
  server.tool(
    'get_employee',
    '社員の詳細情報を取得する。社員IDまたは社員番号を指定。',
    {
      employee_id: z.string().describe('社員のUUID、または社員番号（EMP-012など）'),
    },
    async (params) => {
      try {
        // 社員番号の場合は検索してIDを取得
        let employeeId = params.employee_id;
        if (employeeId.startsWith('EMP-')) {
          const searchResult = await apiRequest('GET', `/employees?search=${employeeId}&limit=1`);
          if (!searchResult.data || searchResult.data.length === 0) {
            return { content: [{ type: 'text', text: `社員番号 ${employeeId} の社員が見つかりません。` }] };
          }
          employeeId = searchResult.data[0].id;
        }

        const emp = await apiRequest('GET', `/employees/${employeeId}`);

        const info = [
          `社員番号: ${emp.employeeCode}`,
          `氏名: ${emp.lastName} ${emp.firstName}（${emp.lastNameKana} ${emp.firstNameKana}）`,
          `部署: ${emp.department?.name || '--'}`,
          `役職: ${emp.position?.name || '--'}`,
          `雇用形態: ${emp.employmentType === 'regular' ? '正社員' : '契約社員'}`,
          `雇用区分: ${emp.contractType === 'indefinite' ? '無期' : '有期'}`,
          `ステータス: ${emp.status === 'active' ? '在籍' : emp.status === 'leave' ? '休職' : '退職'}`,
          `入社日: ${emp.hireDate}`,
          `メール: ${emp.email}`,
          emp.baseSalary ? `基本給: ${emp.baseSalary.toLocaleString()}円` : null,
          emp.rewardRate ? `還元率: ${emp.rewardRate}%` : null,
        ].filter(Boolean);

        return { content: [{ type: 'text', text: info.join('\n') }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );
}
