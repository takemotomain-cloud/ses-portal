# SES Portal — Claude Code セットアップ手順

Claude Code のターミナルで以下を順番に実行してください。
各ステップの完了を確認してから次に進んでください。

---

## Step 0: 前提確認

```bash
# Node.js 20+ が入っているか
node -v

# pnpm が入っているか（なければインストール）
pnpm -v || npm install -g pnpm

# Docker が入っているか
docker -v
docker compose version
```

---

## Step 1: プロジェクトをクローン＆依存インストール

```bash
# ses-portal フォルダに移動（Claude.aiから出力済みのフォルダ）
cd ses-portal

# 依存パッケージをインストール
pnpm install
```

もしエラーが出たら `node_modules` を削除して再実行:
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

---

## Step 2: Docker で PostgreSQL + Redis を起動

```bash
# DB + Redis をバックグラウンドで起動
docker compose up -d

# 起動確認（両方 healthy になるまで待つ）
docker compose ps
```

期待する出力:
```
ses-portal-db     running (healthy)
ses-portal-redis  running (healthy)
```

接続テスト:
```bash
# PostgreSQL に接続できるか確認
docker exec ses-portal-db psql -U ses_dev -d ses_portal -c "SELECT 1;"

# Redis に接続できるか確認
docker exec ses-portal-redis redis-cli ping
```

---

## Step 3: マイグレーション実行（テーブル作成）

```bash
# migrations/ フォルダの SQL を順番に実行
for f in migrations/0*.sql; do
  echo "=== Running: $f ==="
  docker exec -i ses-portal-db psql -U ses_dev -d ses_portal < "$f"
  echo ""
done
```

確認:
```bash
# テーブルが19個作成されたか確認
docker exec ses-portal-db psql -U ses_dev -d ses_portal -c "\dt"
```

期待する出力（19テーブル）:
```
 departments
 positions
 employees
 emergency_contacts
 dependents
 users
 clients
 assignments
 attendances
 leave_balances
 leave_requests
 expense_requests
 expense_items
 change_requests
 payrolls
 notifications
 work_rules
 certificates
 yearend_adjustments
 audit_logs
```

---

## Step 4: 環境変数ファイルを作成

### API側
```bash
cat > apps/api/.env << 'EOF'
DATABASE_URL="postgresql://ses_dev:ses_dev_password@localhost:5432/ses_portal?schema=public"
JWT_SECRET="local-dev-jwt-secret-change-in-production-must-be-at-least-64-chars-long-for-security"
JWT_EXPIRY="24h"
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
REDIS_URL="redis://localhost:6379"
ENCRYPTION_KEY="local-dev-encryption-key-change-in-prod"
EOF
```

### Web側
```bash
cat > apps/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-nextauth-secret
EOF
```

---

## Step 5: Prisma クライアント生成

```bash
cd apps/api
npx prisma generate
cd ../..
```

確認:
```bash
ls apps/api/node_modules/.prisma/client/
```

---

## Step 6: API サーバー起動

```bash
# NestJS API を起動（別ターミナルまたはバックグラウンドで）
cd apps/api
pnpm dev
```

起動確認（別ターミナルで）:
```bash
# ヘルスチェック（まだ /health エンドポイントがないのでログイン試行で確認）
curl -s http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"k.yamamoto@example.com","password":"ChangeMe123!"}' | head -c 200
```

期待する出力（JWTトークンが返る）:
```json
{"accessToken":"eyJhbG...","user":{"id":"...","name":"山本 浩二",...}}
```

---

## Step 7: フロントエンド起動

```bash
# 別ターミナルで
cd apps/web
pnpm dev
```

ブラウザで http://localhost:3000 にアクセス。
→ ログイン画面が表示されればOK。

ログイン:
- メール: `k.yamamoto@example.com`
- パスワード: `ChangeMe123!`

---

## Step 8: 動作確認チェックリスト

| # | 確認項目 | 方法 |
|---|---------|------|
| 1 | ログイン画面が表示される | http://localhost:3000 |
| 2 | ログインできる | メール + パスワード入力 |
| 3 | マイページが表示される | ログイン後の遷移 |
| 4 | API Swagger が見える | http://localhost:3001/api/docs |
| 5 | 社員一覧APIが返る | curl http://localhost:3001/api/employees (要JWT) |

### API テスト用コマンド

```bash
# トークンを取得して変数に保存
TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"k.yamamoto@example.com","password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

echo "Token: ${TOKEN:0:20}..."

# 社員一覧
curl -s http://localhost:3001/api/employees \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 自分の情報
curl -s http://localhost:3001/api/employees/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 有給残日数
curl -s http://localhost:3001/api/leave/balance \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 就業規則
curl -s http://localhost:3001/api/rules/current \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## Step 9: MCP サーバー接続（オプション）

```bash
# MCPサーバーをビルド
cd apps/mcp
pnpm install
pnpm build

# Claude Desktop の設定ファイルに追加
# Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
# Windows: %APPDATA%\Claude\claude_desktop_config.json

cat << EOF
以下を claude_desktop_config.json の mcpServers に追加:

"ses-portal": {
  "command": "node",
  "args": ["$(pwd)/dist/index.js"],
  "env": {
    "SES_API_URL": "http://localhost:3001",
    "SES_API_TOKEN": "$TOKEN"
  }
}
EOF
```

Claude Desktop を再起動すると、以下のような指示が可能に:
- 「社員一覧を見せて」
- 「山本浩二の情報を教えて」
- 「承認待ちの申請はある？」

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `docker compose up` 失敗 | Docker未起動 | Docker Desktopを起動 |
| マイグレーションエラー | pgcrypto未有効化 | `001_extensions_and_functions.sql` が実行されたか確認 |
| Prisma generate 失敗 | DATABASE_URL未設定 | `.env` ファイルを確認 |
| API起動時にDB接続エラー | Dockerが起動していない or ポート競合 | `docker compose ps` で確認 |
| ログインで401 | シードデータ未投入 | `008_seed_data.sql` が実行されたか確認 |
| フロント→API接続エラー | APIが起動していない or CORS | API起動確認 + `.env` のCORS_ORIGIN確認 |
| bcryptエラー | パスワードハッシュ不一致 | シードデータのハッシュを再生成 |

### bcryptハッシュの再生成（シードデータのパスワードが合わない場合）

```bash
node -e "const bcrypt=require('bcrypt');bcrypt.hash('ChangeMe123!',12).then(h=>console.log(h))"
```

出力されたハッシュを `008_seed_data.sql` の `password_hash` に置き換えて再実行:
```bash
docker exec -i ses-portal-db psql -U ses_dev -d ses_portal -c "
  UPDATE users SET password_hash = 'ここに新しいハッシュ'
  WHERE employee_id = 'e0000001-0000-0000-0000-000000000001';
"
```
