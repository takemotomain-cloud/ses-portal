import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * システム管理者ガード
 *
 * SYSTEM_ADMIN_SECRET 環境変数と照合するAPIキー認証。
 * X-System-Admin-Key ヘッダーまたは ?key= クエリパラメータで渡す。
 */
@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = process.env.SYSTEM_ADMIN_SECRET;

    if (!secret) {
      throw new UnauthorizedException('システム管理者シークレットが設定されていません');
    }

    const provided =
      request.headers['x-system-admin-key'] as string ||
      request.query['key'] as string;

    if (!provided || provided !== secret) {
      throw new UnauthorizedException('システム管理者認証に失敗しました');
    }

    return true;
  }
}
