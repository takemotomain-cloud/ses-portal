# 本番公開前チェックリスト

## 1. 開発環境で通すこと

- `pnpm install`
- `docker compose up -d`
- `pnpm --filter api db:migrate`
- `pnpm --filter api db:seed`
- `npm run check:secrets`
- `pnpm --filter @ses-portal/web build`
- `pnpm --filter @ses-portal/api test -- --runInBand`
- `node_modules/.bin/playwright test`

## 2. ステージング環境で通すこと

- 管理者ログインできる
- 社員ログインできる
- リロード後もログイン状態が維持される
- 管理側ダッシュボード、クライアント一覧、社員一覧が開ける
- 社員側マイページ、勤怠、申請、通知が開ける
- 権限外画面にアクセスできない
- Google Drive OAuth の往復が成功する
- freee 連携は `FREEE_SYNC_MODE=live` のときだけ実行可能
- DB停止時に `/api/health` が `503` を返す

## 3. 本番設定で確認すること

- `APP_BASE_URL`
- `CORS_ORIGIN`
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `FREEE_SYNC_MODE`

## 4. インフラ公開前の確認

- Web は S3 静的配信ではなく Next.js コンテナ配備になっている
- API / Web イメージが ECR に push されている
- CloudFront のデフォルトオリジンが Web、`/api/*` が API を向いている
- Secrets Manager に本番シークレットが登録済み
- RDS バックアップ、削除保護、監視アラートが有効

## 5. 公開直前の運用確認

- ロールバック手順がある
- 本番DBの復元手順がある
- エラー監視先が決まっている
- 初期管理者アカウントのパスワードを変更済み
- seed の `ChangeMe123!` 系アカウントを本番で残さない
