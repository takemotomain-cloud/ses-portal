/**
 * 勤怠管理ツール
 *
 * Claudeが使える勤怠関連の操作:
 * - get_attendance: 社員の月次勤怠データを取得
 * - clock_in: 出勤打刻
 * - clock_out: 退勤打刻
 * - get_missed_clocks: 打刻漏れを検知
 *
 * 使用例:
 *   「山田太郎の今月の勤怠を見せて」
 *   「打刻漏れがある社員を教えて」
 *   「山田太郎の出勤を打刻して」
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest, parseYearMonth, formatMinutes } from '../utils/api-client';

export function registerAttendanceTools(server: McpServer) {

  // 月次勤怠データ取得
  server.tool(
    'get_attendance',
    '社員の月次勤怠データを取得する。出勤日数・実働時間・残業時間のサマリーと日次の打刻記録を返す。',
    {
      employee_id: z.string().describe('社員ID'),
      year_month: z.string().describe('対象年月（例: 2026年4月, 2026-04）'),
    },
    async (params) => {
      try {
        const { year, month } = parseYearMonth(params.year_month);
        const data = await apiRequest('GET', `/attendance/${year}/${month}`);

        if (!data || data.length === 0) {
          return { content: [{ type: 'text', text: `${year}年${month}月の勤怠データはありません。` }] };
        }

        // サマリー計算
        const worked = data.filter((d: any) => d.clockIn && d.clockOut);
        const totalWork = worked.reduce((s: number, d: any) => s + (d.workMinutes || 0), 0);
        const totalOT = worked.reduce((s: number, d: any) => s + (d.overtimeMinutes || 0), 0);
        const missed = data.filter((d: any) => d.isMissedClock).length;

        const summary = [
          `📊 ${year}年${month}月の勤怠サマリー`,
          `出勤日数: ${worked.length}日`,
          `実働時間: ${formatMinutes(totalWork)}`,
          `残業時間: ${formatMinutes(totalOT)}`,
          `打刻漏れ: ${missed}件`,
          '',
          '日次データ:',
        ];

        const daily = data.map((d: any) => {
          const date = new Date(d.workDate);
          const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
          const clockIn = d.clockIn ? new Date(d.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
          const clockOut = d.clockOut ? new Date(d.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
          const work = d.workMinutes ? formatMinutes(d.workMinutes) : '--';
          const ot = d.overtimeMinutes && d.overtimeMinutes > 0 ? formatMinutes(d.overtimeMinutes) : '0分';
          const flag = d.isMissedClock ? ' ⚠️打刻漏れ' : '';
          return `  ${dateStr}: ${clockIn}〜${clockOut}（稼働${work} / 残業${ot}）${flag}`;
        });

        return { content: [{ type: 'text', text: [...summary, ...daily].join('\n') }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 出勤打刻
  server.tool(
    'clock_in',
    '社員の出勤を打刻する。本日分の出勤記録を作成する。',
    {
      employee_id: z.string().describe('社員ID'),
    },
    async (params) => {
      try {
        await apiRequest('POST', '/attendance/clock-in');
        return { content: [{ type: 'text', text: '出勤を打刻しました。' }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 退勤打刻
  server.tool(
    'clock_out',
    '社員の退勤を打刻する。稼働時間と残業時間が自動計算される。',
    {
      employee_id: z.string().describe('社員ID'),
    },
    async (params) => {
      try {
        const result = await apiRequest('POST', '/attendance/clock-out');
        const work = result.workMinutes ? formatMinutes(result.workMinutes) : '--';
        const ot = result.overtimeMinutes ? formatMinutes(result.overtimeMinutes) : '0分';
        return { content: [{ type: 'text', text: `退勤を打刻しました。\n稼働時間: ${work}\n残業時間: ${ot}` }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );

  // 打刻漏れ検知
  server.tool(
    'get_missed_clocks',
    '打刻漏れ（出勤したが退勤打刻がない）を検知する。',
    {
      employee_id: z.string().describe('社員ID'),
    },
    async (params) => {
      try {
        const data = await apiRequest('GET', '/attendance/missed');

        if (!data || data.length === 0) {
          return { content: [{ type: 'text', text: '打刻漏れはありません。' }] };
        }

        const lines = data.map((d: any) => {
          const date = new Date(d.workDate);
          return `  ⚠️ ${date.getMonth() + 1}月${date.getDate()}日 — 出勤 ${new Date(d.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}、退勤未打刻`;
        });

        return { content: [{ type: 'text', text: `打刻漏れ ${data.length}件:\n${lines.join('\n')}` }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: `エラー: ${error.message}` }], isError: true };
      }
    }
  );
}
