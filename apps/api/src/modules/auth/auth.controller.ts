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
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

const AUTH_COOKIE_NAME = 'ses_portal_token';

function setAuthCookie(req: Request, res: Response, token: string) {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const isSecure = process.env.NODE_ENV === 'production' || forwardedProto === 'https';

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(req: Request, res: Response) {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const isSecure = process.env.NODE_ENV === 'production' || forwardedProto === 'https';

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
  });
}

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログイン中ユーザー情報を取得' })
  async me(@CurrentUser() user: RequestUser) {
    return {
      id: user.userId,
      employeeId: user.employeeId,
      employeeCode: user.employeeCode,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeStatus: user.employeeStatus ?? 'active',
      resignDate: user.resignDate ?? null,
      tenantId: user.tenantId,
      tenantName: user.tenantName ?? 'SES Portal',
      subdomain: user.subdomain ?? null,
    };
  }

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
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password, dto.subdomain, extractMeta(req));
    setAuthCookie(req, res, result.accessToken);
    return result;
  }

  /**
   * ログアウト（監査ログ記録のみ。クライアント側で JWT を破棄する運用）
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ログアウト（監査ログのみ記録）' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.userId, user.tenantId, extractMeta(req));
    clearAuthCookie(req, res);
    return { ok: true };
  }

  /**
   * テナント情報の取得（ログイン画面用）
   */
  @Get('tenant/:subdomain')
  @ApiOperation({ summary: 'サブドメインからテナント情報を取得' })
  @ApiResponse({ status: 200, description: 'テナント情報を返却' })
  @ApiResponse({ status: 401, description: '無効なテナント' })
  async getTenantInfo(@Param('subdomain') subdomain: string) {
    return this.authService.getTenantBySubdomain(subdomain);
  }
}
