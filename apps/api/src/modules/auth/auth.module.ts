/**
 * Auth Module
 *
 * 認証・認可の全ロジックを集約するモジュール。
 * 独自実装を各所に散らさず、ここに一元化する（セキュリティ原則）。
 *
 * 構成:
 * - AuthController: ログイン/ログアウトのエンドポイント
 * - AuthService: パスワード検証、JWT発行、アカウントロック
 * - JwtStrategy: リクエストからJWTを検証してユーザー情報を注入
 * - JwtAuthGuard: 各エンドポイントで認証チェック
 * - RolesGuard: ロールベースのアクセス制御
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRY', '24h'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
