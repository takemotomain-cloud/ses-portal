/**
 * Auth Controller
 *
 * 認証エンドポイント。ログイン/ログアウトを提供。
 * 入力はclass-validatorで自動バリデーション（main.tsのValidationPipe）。
 *
 * セキュリティ: ログインエンドポイントは認証不要（@Public）。
 * それ以外は全エンドポイントJwtAuthGuardで保護。
 *
 * T2: 監査ログで認証イベント（login_success/login_failure/logout）を記録する。
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

function extractMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  const forwarded = (req.headers['x-forwarded-for'] as string) || '';
  const ip = forwarded.split(',')[0]?.trim() || req.ip || (req.socket && req.socket.remoteAddress) || undefined;
  const ua = (req.headers['user-agent'] as string) || undefined;
  return { ipAddress: ip, userAgent: ua };
}

@ApiTags('認証')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * ログイン
   *
   * メールアドレスとパスワードでJWTを発行する。
   * レート制限は本番環境でCloudFront/WAFレベルで実施。
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ログイン' })
  @ApiResponse({ status: 200, description: 'ログイン成功。JWTトークンを返却' })
  @ApiResponse({ status: 401, description: '認証失敗' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.email, dto.password, extractMeta(req));
  }

  /**
   * ログアウト（監査ログ記録のみ。クライアント側で JWT を破棄する運用）
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト（監査ログのみ記録）' })
  async logout(@CurrentUser() user: RequestUser, @Req() req: Request) {
    await this.authService.logout(user.userId, extractMeta(req));
    return { ok: true };
  }
}
