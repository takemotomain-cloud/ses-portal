# ============================================================
# SES Portal Web — Dockerfile
# ============================================================
# Next.js standalone 出力を使って Web をコンテナ実行する。
# 本番では CloudFront 配下の ECS Fargate から配信する。
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --no-frozen-lockfile

COPY . .

# public ディレクトリが存在しない場合でも COPY が失敗しないよう作成しておく
RUN mkdir -p apps/web/public

ENV API_URL=http://api:3001
RUN pnpm turbo build --filter=@ses-portal/web...

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV API_URL=http://api:3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/login || exit 1

CMD ["node", "apps/web/server.js"]
