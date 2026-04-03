/**
 * @Roles() デコレータ
 *
 * エンドポイントに必要なロールを指定する。
 * RolesGuardと組み合わせて使用。
 *
 * 使い方:
 *   @Roles('admin')           ← 管理者のみ
 *   @Roles('admin', 'sales')  ← 管理者または営業
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
