/**
 * @CurrentUser() デコレータ
 *
 * request.user から認証済みユーザー情報を取得するショートカット。
 * JwtAuthGuardが適用されているエンドポイントでのみ使用可能。
 *
 * 使い方:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: RequestUser) {
 *     return user.employeeId;
 *   }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  userId: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // 特定のフィールドだけ取得する場合: @CurrentUser('employeeId')
    if (data) {
      return user[data];
    }

    return user;
  },
);
