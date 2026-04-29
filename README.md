# SES基幹システム — SES Portal

SES事業（50〜200人規模）の社員情報基幹システム。  
社員マスタを中核に勤怠・経理・営業・採用管理を自作、会計ソフトのみfreee会計と外部連携。

## システム構成図

```
┌─────────────────────────────────────────────────────────┐
│                    AWS CloudFront (CDN)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              apps/web (Next.js 14)                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ 社員側    │  │ 管理側    │  │ NextAuth.js (JWT)     │ │
│  │ マイページ │  │ 管理画面   │  │ ロールベースアクセス   │ │
│  └──────────┘  └──────────┘  └────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────┐
│              apps/api (NestJS)                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ Auth │ │ 社員 │ │ 勤怠 │ │ 給与 │ │ 申請 │  ...     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         AWS RDS PostgreSQL (Multi-AZ)                    │
│         + ElastiCache Redis (セッション/キャッシュ)        │
└─────────────────────────────────────────────────────────┘
```

## ディレクトリ構成

```
ses-portal/
├── apps/
│   ├── web/                    # Next.js 14 フロントエンド
│   │   ├── src/
│   │   │   ├── app/            # App Router
│   │   │   │   ├── (auth)/     # ログイン画面
│   │   │   │   ├── (employee)/ # 社員マイページ
│   │   │   │   └── (admin)/    # 管理画面
│   │   │   ├── components/     # UIコンポーネント
│   │   │   ├── lib/            # ユーティリティ
│   │   │   └── types/          # TypeScript型定義
│   │   ├── next.config.js
│   │   └── tailwind.config.ts
│   │
│   └── api/                    # NestJS バックエンド
│       ├── src/
│       │   ├── modules/        # 機能モジュール
│       │   │   ├── auth/       # 認証
│       │   │   ├── employees/  # 社員管理
│       │   │   ├── attendance/ # 勤怠
│       │   │   ├── leave/      # 有給休暇
│       │   │   ├── expense/    # 経費
│       │   │   └── ...
│       │   ├── common/         # 共通（ガード, フィルター, インターセプター）
│       │   ├── database/       # DB接続, マイグレーション
│       │   └── config/         # 環境設定
│       └── test/
│
├── packages/
│   └── shared/                 # 共有型定義・定数・バリデーションルール
│       ├── types/
│       ├── constants/
│       └── validators/
│
├── migrations/                 # SQLマイグレーション
├── docs/                       # 設計書・仕様書
├── docker-compose.yml          # ローカル開発環境
├── package.json                # ワークスペースルート
└── turbo.json                  # Turborepo設定
```

## 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| フロントエンド | Next.js + TypeScript + Tailwind CSS | 14.x |
| バックエンド | NestJS + TypeScript | 10.x |
| ORM | Prisma | 6.x |
| データベース | PostgreSQL | 16.x |
| 認証 | NextAuth.js + JWT | 5.x (Auth.js) |
| キャッシュ | Redis (ElastiCache) | 7.x |
| モノレポ | Turborepo + pnpm workspaces | - |
| インフラ | AWS (ECS Fargate, RDS, CloudFront, S3) | - |
| 外部連携 | freee会計 (OAuth2.0 + REST API) | - |

## ロール・権限

| ロール | 画面 | 権限 |
|--------|------|------|
| admin | 管理画面全画面 + マイページ | 全操作 |
| sales | 営業系画面 + マイページ | 稼働・クライアント・営業管理 |
| accounting | 経理系画面 + マイページ | 経費・請求・給与・freee連携 |
| employee | マイページのみ | 自分の勤怠・申請・給与確認 |

## 環境構築手順

### 前提条件

- Node.js 20.x (LTS)
- pnpm 9.x
- Docker & Docker Compose
- PostgreSQL 16 (ローカルはDocker)

### セットアップ

```bash
# 1. リポジトリクローン
git clone <repository-url>
cd ses-portal

# 2. 依存パッケージインストール
pnpm install

# 3. 環境変数ファイル作成
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 4. Docker でDB起動
docker compose up -d

# 5. マイグレーション実行
pnpm --filter api db:migrate

# 6. シードデータ投入
pnpm --filter api db:seed

# 7. 開発サーバー起動
pnpm dev
```

### 起動後のアクセス

| サービス | URL |
|---------|-----|
| フロントエンド | http://localhost:3000 |
| API | http://localhost:3001 |
| API ドキュメント (Swagger) | http://localhost:3001/api/docs |

## セキュリティ設定

| 項目 | 設定 |
|------|------|
| パスワード | bcrypt (cost factor 12) |
| セッション | JWT (HttpOnly / Secure / SameSite=Strict) |
| CORS | 許可オリジン: フロントエンドURLのみ |
| DB接続 | SSL/TLS必須 |
| 暗号化カラム | pgcrypto (マイナンバー, 口座情報, 住所, 電話) |
| HTTPS | 本番必須 (CloudFront で終端) |
| CSP | Content-Security-Policy ヘッダー設定 |
| ログイン失敗 | 5回連続でアカウントロック |

## 開発ロードマップ

| Phase | 内容 | 期間 |
|-------|------|------|
| Phase 1 | 社員マスタ + ポータル | 2〜3ヶ月 |
| Phase 2 | 勤怠管理本格化 | 2〜3ヶ月 |
| Phase 3 | 給与・経理システム | 3〜4ヶ月 |
| Phase 4 | 営業管理 | 2〜3ヶ月 |

## バックアップ・リカバリ

- **自動バックアップ**: 毎日 (RDS自動バックアップ, 保持30日)
- **PITR**: 5分間隔のポイントインタイムリカバリ
- **クロスリージョン**: ap-northeast-1 → ap-northeast-3
- **暗号化**: AES-256 (AWS KMS)
- **復元テスト**: 四半期に1回実施

## よくあるトラブルと対処法

| 症状 | 原因 | 対処 |
|------|------|------|
| DB接続エラー | Docker未起動 or .env設定ミス | `docker compose up -d` + .env確認 |
| マイグレーション失敗 | 依存テーブル未作成 | 番号順に実行されているか確認 |
| ログインできない | アカウントロック | usersテーブルのis_lockedをFALSEに |
| CORS エラー | API側の許可オリジン不一致 | apps/api/.envのCORS_ORIGINを確認 |
