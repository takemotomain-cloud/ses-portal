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

# 全ソースをコピー（pnpm deploy のため）
COPY . .

RUN pnpm install --no-frozen-lockfile

# ビルド
RUN pnpm turbo build --filter=@ses-portal/api...

# 実行用ファイルを抽出 (pnpm deploy)
RUN pnpm --filter @ses-portal/api --prod deploy pruned
# ビルド成果物を pruned に手動でコピー（pnpm deploy は package.json の files 等に従うため）
RUN cp -r apps/api/dist pruned/dist
# pruned 側で再度 prisma generate を実行し、.prisma/client を生成する
RUN cd pruned && npx prisma@6 generate

# --- Stage 2: Production ---
FROM node:20-alpine AS runner

WORKDIR /app

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 起動に必要なディレクトリの準備と権限設定
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

# pruned ディレクトリから成果物をコピー
COPY --from=builder --chown=nestjs:nodejs /app/pruned/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/pruned/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/pruned/package.json ./

USER nestjs

EXPOSE 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/main.js"]
