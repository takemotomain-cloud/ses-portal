# SES Portal MCP Server

ClaudeからSES基幹システムを自然言語で操作するためのMCPサーバー。

## 概要

このMCPサーバーをClaude DesktopやClaude.aiに接続すると、以下のような自然言語でシステムを操作できます:

- 「山田太郎の今月の勤怠を見せて」
- 「承認待ちの有給申請を全部見せて」
- 「佐藤健太の有給申請を承認して」
- 「エリア別の稼働率を比較して」
- 「30日以内に契約が切れるエンジニアは？」

## セットアップ

### 1. ビルド

```bash
cd apps/mcp
pnpm install
pnpm build
```

### 2. Claude Desktop に接続

`~/Library/Application Support/Claude/claude_desktop_config.json`（Mac）に以下を追加:

```json
{
  "mcpServers": {
    "ses-portal": {
      "command": "node",
      "args": ["/path/to/ses-portal/apps/mcp/dist/index.js"],
      "env": {
        "SES_API_URL": "http://localhost:3001",
        "SES_API_TOKEN": "your-admin-jwt-token"
      }
    }
  }
}
```

### 3. JWTトークンの取得

```bash
# APIにログインしてトークンを取得
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"k.yamamoto@example.com","password":"your-password"}'

# レスポンスの accessToken を SES_API_TOKEN に設定
```

## 利用可能なツール一覧

### 社員管理
| ツール | 説明 |
|--------|------|
| `search_employees` | 社員を検索（氏名・番号・ステータス） |
| `get_employee` | 社員の詳細情報を取得 |

### 勤怠管理
| ツール | 説明 |
|--------|------|
| `get_attendance` | 月次勤怠データ（サマリー + 日次） |
| `clock_in` | 出勤打刻 |
| `clock_out` | 退勤打刻（稼働・残業自動計算） |
| `get_missed_clocks` | 打刻漏れ検知 |

### 有給休暇
| ツール | 説明 |
|--------|------|
| `get_leave_balance` | 有給残日数（ロット別内訳付き） |
| `create_leave_request` | 有給申請を作成 |
| `list_pending_leaves` | 承認待ち一覧 |
| `approve_leave` | 承認（FIFO自動消化） |
| `reject_leave` | 却下 |

### 稼働管理
| ツール | 説明 |
|--------|------|
| `get_current_assignment` | 現在の稼働先（単価・精算幅） |
| `get_assignment_history` | 稼働ヒストリー |

### 承認
| ツール | 説明 |
|--------|------|
| `list_pending_approvals` | 全承認待ち一覧（有給・経費・変更） |
| `approve_request` | 申請を承認 |
| `reject_request` | 申請を却下 |

### ダッシュボード
| ツール | 説明 |
|--------|------|
| `get_dashboard` | 経営ダッシュボード（エリア別比較） |
| `get_expiring_contracts` | 契約終了が近いアサイン一覧 |

## セキュリティ

- **管理者権限必須**: MCPサーバーは管理者のJWTトークンで動作
- **読み取り/書き込み区別**: 検索・閲覧は自由、承認・変更は確認プロンプト付き
- **マイナンバー非公開**: MCPツールからはマイナンバーにアクセス不可
- **監査ログ**: 全操作はaudit_logsに記録される
