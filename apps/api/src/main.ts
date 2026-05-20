/**
 * SES Portal API — エントリーポイント
 *
 * NestJSアプリケーションのブートストラップ。
 * セキュリティミドルウェア（Helmet, CORS, ValidationPipe）を設定。
 *
 * セキュリティ考慮:
 * - Helmet: セキュリティヘッダー一括設定
 * - CORS: 許可オリジンを環境変数で制御（本番で * は禁止）
 * - ValidationPipe: 全エンドポイントの入力を自動バリデーション
 * - whitelist: リクエストボディから未定義プロパティを自動除去
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// .envを手動ロード（pnpm + nest start --watch でdotenvのパス解決が不安定なため）
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=["']?([^"'\n]*)["']?$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2];
    }
  }
} catch {}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // セキュリティヘッダー（X-Content-Type-Options, X-Frame-Options等）
  app.use(helmet());

  // CORS: 環境変数で許可オリジンを制御
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-system-admin-key'],
  });

  // 全エンドポイントの入力バリデーション
  // whitelist: DTOに定義されていないプロパティを自動除去（余計なデータ送信を防止）
  // forbidNonWhitelisted: 未定義プロパティがあればエラーにする
  // transform: パスパラメータの型変換を自動化
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 静的ファイル配信（アップロ���ドされた画像等）
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // APIプレフィックス
  app.setGlobalPrefix('api');

  // Swagger (開発環境のみ)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SES Portal API')
      .setDescription('SES基幹システム REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`SES Portal API running on port ${port}`);
}

bootstrap();
