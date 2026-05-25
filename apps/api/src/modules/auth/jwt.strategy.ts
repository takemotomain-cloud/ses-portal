/**
 * JWT Strategy (Passport)
 *
 * リクエストのAuthorizationヘッダーからBearerトークンを抽出し、
 * 署名を検証してペイロードをrequest.userに注入する。
 *
 * なぜPassport: JWTの検証ロジックをフレームワークに委譲し、
 * 独自実装によるセキュリティホールを防ぐ。
 *
 * 注意: validate()で返す値がrequest.userになる。
 * 必要最小限のフィールドのみ含める（パスワード等は含めない）。
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';

/** JWTペイロードの型 */
interface JwtPayload {
  sub: string;       // user.id
  employeeId: string;
  role: string;
  iat: number;
  exp: number;
}

function extractJwtFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('ses_portal_token='));

  return cookie ? decodeURIComponent(cookie.slice('ses_portal_token='.length)) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: { headers?: { cookie?: string } }) => extractJwtFromCookie(req?.headers?.cookie),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  /**
   * JWTの署名検証が通った後に呼ばれる。
   * ここでユーザーの存在確認・ロック確認を行い、
   * request.userに設定する値を返す。
   *
   * 落とし穴: JWT発行後にアカウントロック/削除された場合、
   * トークンは有効でもここで弾く必要がある。
   */
  async validate(payload: JwtPayload) {
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            lastName: true,
            firstName: true,
            email: true,
            status: true,
            resignDate: true,
            deletedAt: true,
          },
        },
        tenant: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
    });

    // ユーザーが存在しない or 論理削除済み
    if (!user || user.employee.deletedAt) {
      throw new UnauthorizedException('無効なトークンです');
    }

    // アカウントロック中
    if (user.isLocked) {
      throw new UnauthorizedException('アカウントがロックされています');
    }

    // 退職済み
    if (user.employee.status === 'resigned') {
      throw new UnauthorizedException('このアカウントは無効です');
    }

    // request.user に設定される値
    return {
      userId: user.id,
      employeeId: user.employee.id,
      employeeCode: user.employee.employeeCode,
      name: `${user.employee.lastName} ${user.employee.firstName}`,
      email: user.employee.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      subdomain: user.tenant.subdomain,
      employeeStatus: user.employee.status,
      resignDate: user.employee.resignDate
        ? user.employee.resignDate.toISOString().slice(0, 10)
        : null,
    };
  }
}
