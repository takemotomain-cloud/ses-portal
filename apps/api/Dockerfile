# ============================================================
# SES Portal API — Dockerfile
# ============================================================
# Multi-stage build: ビルド用 → 実行用で最終イメージを軽量化
#
# ビルド: docker build -t ses-portal-api apps/api/
# 実行:   docker run -p 3001:3001 --env-file apps/api/.env ses-portal-api
# ============================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm をインストール
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依存パッケージのインストール（キャッシュ効率化のためpackage.jsonだけ先にコピー）
COPY package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --filter @ses-portal/api...

# ソースコードをコピー
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Prisma クライアント生成
RUN cd apps/api && npx prisma generate

# ビルド
RUN cd apps/api && pnpm build

# --- Stage 2: Production ---
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# ビルド成果物と依存パッケージをコピー
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./

# Prisma クライアントをコピー
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma

USER nestjs

EXPOSE 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/main.js"]
