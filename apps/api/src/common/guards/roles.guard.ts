/**
 * Roles Guard
 *
 * ロールベースのアクセス制御。@Roles()デコレータと組み合わせて使用。
 * 「ログイン済みなら何でもできる」設計にしない（セキュリティ原則）。
 *
 * 使い方:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin', 'manager')
 *   getEmployees() { ... }
 *
 * 注意: JwtAuthGuardより後に配置すること（request.userが必要）
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Roles() で指定されたロールを取得
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles() が付いていなければ全ロール許可
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // JwtStrategyが注入したrequest.userからロールを取得
    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('この操作を行う権限がありません');
    }

    return true;
  }
}
