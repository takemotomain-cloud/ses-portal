/**
 * Auth Controller
 *
 * 認証エンドポイント。ログイン/パスワード変更を提供。
 * 入力はclass-validatorで自動バリデーション（main.tsのValidationPipe）。
 *
 * セキュリティ: ログインエンドポイントは認証不要（@Public）。
 * それ以外は全エンドポイントJwtAuthGuardで保護。
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
