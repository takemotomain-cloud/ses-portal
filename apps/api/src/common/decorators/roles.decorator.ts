/**
 * @Roles() デコレータ
 *
 * エンドポイントに必要なロールを指定する。
 * RolesGuardと組み合わせて使用。
 *
 * 使い方:
 *   @Roles('admin')                         ← 管理者のみ
 *   @Roles('admin', 'manager', 'member')    ← 管理側ログイン全員
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
