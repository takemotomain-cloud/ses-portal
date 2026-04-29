#!/usr/bin/env node
/**
 * SES Portal MCP Server
 *
 * ClaudeからSES基幹システムを自然言語で操作できるようにするMCPサーバー。
 *
 * 何をするか:
 *   NestJS APIのラッパーとして機能し、Claudeが以下のような指示を処理できるようにする:
 *   - 「山田太郎の今月の勤怠を見せて」
 *   - 「佐藤健太の有給残日数を教えて」
 *   - 「今月の稼働率をエリア別に比較して」
 *   - 「中村拓海の契約をあと3ヶ月延長して」
 *
 * なぜMCPサーバー:
 *   APIを直接呼ぶにはエンドポイント・パラメータの知識が必要。
 *   MCPサーバーがあれば、Claudeが自然言語の意図を解釈して適切なAPIを呼ぶ。
 *   経営者・人事担当者がコードを書かずにシステムを操作できる。
 *
 * セキュリティ:
 *   - MCPサーバーはJWTトークンを使ってAPIにアクセス
 *   - 管理者権限のトークンのみ許可（社員ロールでは起動不可）
 *   - 個人情報（マイナンバー等）へのアクセスは明示的な確認を要求
 *   - 破壊的操作（削除・退職処理）は確認プロンプトを表示
 *
 * 接続方法（Claude Desktop）:
 *   claude_desktop_config.json に以下を追加:
 *   {
 *     "mcpServers": {
 *       "ses-portal": {
 *         "command": "node",
 *         "args": ["/path/to/ses-portal/apps/mcp/dist/index.js"],
 *         "env": {
 *           "SES_API_URL": "http://localhost:3001",
 *           "SES_API_TOKEN": "your-jwt-token"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { apiRequest } from './utils/api-client';

// Tool imports
import { registerEmployeeTools } from './tools/employees';
import { registerAttendanceTools } from './tools/attendance';
import { registerLeaveTools } from './tools/leave';
import { registerAssignmentTools } from './tools/assignments';
import { registerApprovalTools } from './tools/approvals';
import { registerDashboardTools } from './tools/dashboard';

// ============================================================
// Server Setup
// ============================================================
const server = new McpServer({
  name: 'ses-portal',
  version: '0.1.0',
});

// ============================================================
// Resources（読み取り専用の情報源）
// ============================================================

// システム概要をリソースとして公開
server.resource(
  'system-overview',
  'ses://system/overview',
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'text/plain',
      text: `SES基幹システム（SES Portal）

このシステムは以下の機能を持っています:
- 社員管理（社員マスタ、個人情報、雇用区分）
- 勤怠管理（出退勤打刻、月次勤怠、休憩時間編集）
- 有給休暇管理（申請、承認/却下、残日数FIFO管理）
- 稼働管理（アサイン、契約単価、精算幅、エリア別管理）
- 給与管理（月次給与計算、明細）
- 承認フロー（有給・経費・情報変更の承認/却下）
- 就業規則（バージョン管理、社員への公開）
- 経費精算、請求管理、契約書管理
- freee会計連携（仕訳送信）

エリア: 東京エリア / 大阪エリア / 名古屋エリア
ロール: admin / sales / accounting / employee
`
    }],
  })
);

// ============================================================
// Register All Tools
// ============================================================
registerEmployeeTools(server);
registerAttendanceTools(server);
registerLeaveTools(server);
registerAssignmentTools(server);
registerApprovalTools(server);
registerDashboardTools(server);

// ============================================================
// Start Server
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SES Portal MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
