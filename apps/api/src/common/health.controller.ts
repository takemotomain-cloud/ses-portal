/**
 * ヘルスチェック コントローラー
 *
 * ALB・Docker・ECSのヘルスチェック用。認証不要。
 * DB接続も確認して、APIだけ動いてDBが落ちている状態を検知する。
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('ヘルスチェック')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'ヘルスチェック' })
  async check() {
    try {
      // DB接続テスト
      await this.db.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  }
}
