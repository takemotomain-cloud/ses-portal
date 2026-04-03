/**
 * JWT Auth Guard
 *
 * 認証が必要なエンドポイントに適用するガード。
 * PassportのJWT戦略を使ってトークンを検証する。
 *
 * 使い方:
 *   @UseGuards(JwtAuthGuard)       ← コントローラーまたはメソッドに付与
 *   @UseGuards(JwtAuthGuard, RolesGuard) ← ロール制限も加える場合
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
