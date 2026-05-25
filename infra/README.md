# SES Portal — AWS Infrastructure

## アーキテクチャ

```
                         ┌──────────────┐
                         │   Route 53   │
                         │ portal.example.com
                         └──────┬───────┘
                                │
                    ┌───────────▼────────────┐
                    │      CloudFront        │
                    │  ・HTTPS終端            │
                    │  ・セキュリティヘッダー   │
                    │  ・Web/API入口を統一     │
                    └───┬───────────┬────────┘
                        │           │
                   /*   │     /api/*│
                        │           │
           ┌────────────▼──┐  ┌─────▼──────────┐
           │      ALB      │  │      ALB        │
           │  Web (Next.js)│  │  (Public Subnet)│
           └──────┬────────┘  └─────┬──────────┘
                  │                 │
                  │                 │
                                    │
          ┌─────────────────────────▼──────────────────────┐
          │              ECS Fargate (Private Subnet)       │
          │  ┌─────────────────────┐                        │
          │  │  Next.js Web        │                        │
          │  │  ・App Router        │                        │
          │  │  ・standalone build  │                        │
          │  └─────────────────────┘                        │
          │  ┌─────────────────────┐                        │
          │  │  NestJS API         │                        │
          │  │  ・認証(JWT)         │                        │
          │  │  ・13モジュール      │                        │
          │  │  ・0.5vCPU / 1GB    │                        │
          │  │  ・Auto Scaling 1-4 │                        │
          │  └──────┬──────────────┘                        │
          └─────────┼──────────────────────────────────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
┌──────▼──────┐ ┌───▼──────┐ ┌───▼──────────┐
│ RDS         │ │ Redis    │ │ Secrets      │
│ PostgreSQL  │ │ (Cache)  │ │ Manager      │
│ 16 Multi-AZ │ │ 7.1      │ │ (DB認証情報) │
│ (Isolated)  │ │(Isolated)│ └──────────────┘
└─────────────┘ └──────────┘
```

## スタック構成

| スタック | リソース | 目的 |
|----------|----------|------|
| SesPortalNetwork | VPC, Subnets, Security Groups | ネットワーク基盤 |
| SesPortalData | RDS PostgreSQL, ElastiCache Redis | データ層 |
| SesPortalApp | ECS Fargate, ALB, CloudFront | アプリケーション層 |

## デプロイ手順

### 前提条件

- AWS CLI がインストール済み、認証情報が設定済み
- AWS CDK がインストール済み (`npm install -g aws-cdk`)
- Docker がインストール済み（ECRプッシュ用）

### 初回デプロイ

```bash
cd infra
pnpm install

# CDK ブートストラップ（初回のみ）
cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1

# 事前にSecrets Managerにシークレットを作成
aws secretsmanager create-secret --name ses-portal/jwt-secret \
  --secret-string '{"value":"YOUR_JWT_SECRET_HERE"}'

aws secretsmanager create-secret --name ses-portal/encryption-key \
  --secret-string '{"value":"YOUR_ENCRYPTION_KEY_HERE"}'

# 差分確認
cdk diff

# デプロイ（全スタック）
cdk deploy --all
```

### APIコンテナのビルド＆プッシュ

```bash
# ECRリポジトリ作成（初回のみ）
aws ecr create-repository --repository-name ses-portal-api

# ビルド＆プッシュ
cd apps/api
docker build -t ses-portal-api .
docker tag ses-portal-api:latest ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/ses-portal-api:latest
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
docker push ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/ses-portal-api:latest
```

### Webコンテナのビルド＆プッシュ

```bash
aws ecr create-repository --repository-name ses-portal-web

cd apps/web
docker build -f Dockerfile -t ses-portal-web ../..
docker tag ses-portal-web:latest ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/ses-portal-web:latest
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
docker push ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/ses-portal-web:latest
```

## セキュリティ設定一覧

| 項目 | 設定 |
|------|------|
| DB暗号化 | AES-256 (AWS KMS) |
| DB接続 | SSL/TLS必須 (rds.force_ssl=1) |
| DBサブネット | Isolated (インターネットアクセス不可) |
| DB認証情報 | Secrets Manager (自動ローテーション対応) |
| Redis暗号化 | in-transit（at-rest は ReplicationGroup 化時に追加予定） |
| CloudFront | HTTPS強制リダイレクト |
| セキュリティヘッダー | HSTS, X-Frame-Options, X-Content-Type, XSS-Protection |
| コンテナ権限 | IAMロールで最小権限 |
| ネットワーク | SG でホワイトリスト方式 |

## バックアップ設定

| 項目 | 設定 |
|------|------|
| 自動バックアップ | 毎日 18:00-19:00 UTC (JST 03:00-04:00) |
| 保持期間 | 30日 |
| PITR | 5分間隔 |
| 暗号化 | AES-256 |
| 削除保護 | 有効 |
| スタック削除時 | DB保持 (RemovalPolicy.RETAIN) |

## 月額コスト概算（初期構成）

| リソース | スペック | 月額概算 |
|---------|---------|----------|
| RDS PostgreSQL | db.t3.medium, Multi-AZ, 50GB | ~$130 |
| ElastiCache Redis | cache.t3.micro | ~$15 |
| ECS Fargate | 0.5vCPU / 1GB × 1タスク | ~$30 |
| ALB | 1台 | ~$25 |
| CloudFront | 基本料金 | ~$10 |
| ECS Fargate(Web) | 0.5vCPU / 1GB × 1タスク | ~$30 |
| NAT Gateway | 1台 | ~$45 |
| Secrets Manager | 3シークレット | ~$2 |
| **合計** | | **~$287/月** |

※ 負荷増加時はFargateタスク数・RDSインスタンスサイズをスケールアップ
