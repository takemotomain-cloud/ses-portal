/**
 * Prisma Database Service
 *
 * PrismaClientのシングルトンインスタンスを管理する。
 * アプリ起動時に接続、終了時にgraceful disconnect。
 *
 * なぜシングルトン: コネクションプールの枯渇を防ぐ。
 * NestJSのDIコンテナがインスタンスを1つだけ保持する。
 *
 * 注意: 本番ではconnection_limitをRDSのmax_connectionsに合わせて調整
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // ログレベル: 開発時はqueryも出力、本番ではerrorのみ
      log:
        process.env.NODE_ENV === 'production'
          ? ['error']
          : ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
