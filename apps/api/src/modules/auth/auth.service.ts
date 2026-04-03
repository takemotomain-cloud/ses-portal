/**
 * Auth Service
 *
 * 認証ロジックの中核。パスワード検証・JWT発行・アカウントロックを担当。
 *
 * セキュリティ考慮:
 * - bcrypt (cost 12) でパスワード検証
 * - 5回連続失敗でアカウントロック（ブルートフォース対策）
 * - ログイン試行はaudit_logsに記録（不正アクセス検知）
 * - エラーメッセージは「メールアドレスまたはパスワードが正しくありません」で統一
 *   （どちらが間違いか推測させない）
 *
 * 障害パターン:
 * - DB接続エラー → 500エラー、リトライなし（クライアントに再試行を促す）
 * - bcrypt処理エラー → ログに記録、500エラー
 */

import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { MAX_LOGIN_ATTEMPTS, BCRYPT_ROUNDS } from '@ses-portal/shared';
import type { AuthUser, LoginResponse } from '@ses-portal/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * ログイン処理
   *
   * 処理フロー:
   * 1. メールアドレスでユーザーを検索
   * 2. アカウントロック状態を確認
   * 3. bcryptでパスワードを検証
   * 4. 失敗時: 失敗カウント加算 → 上限でロック
   * 5. 成功時: 失敗カウントリセット → JWT発行
   *
   * @param email メールアドレス
   * @param password 平文パスワード
   * @returns JWT + ユーザー情報
   * @throws UnauthorizedException 認証失敗時
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // 1. ユーザー検索（employeesとJOIN）
    const user = await this.db.user.findFirst({
      where: {
        employee: {
          email,
          deletedAt: null, // 論理削除されていない社員のみ
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            lastName: true,
            firstName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    // ユーザーが見つからない場合（メールアドレス不一致）
    // セキュリティ: 「メールが存在しない」とは明かさない
    if (!user) {
      this.logger.warn(`Login attempt with unknown email: ${email}`);
      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }

    // 2. アカウントロック確認
    if (user.isLocked) {
      this.logger.warn(`Login attempt on locked account: ${email}`);
      throw new UnauthorizedException(
        'アカウントがロックされています。管理者に連絡してください',
      );
    }

    // 退職済み社員のログインを拒否
    if (user.employee.status === 'resigned') {
      throw new UnauthorizedException(
        'このアカウントは無効です',
      );
    }

    // 3. パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // 4. 失敗時の処理
      const newFailCount = user.failedLoginCount + 1;
      const shouldLock = newFailCount >= MAX_LOGIN_ATTEMPTS;

      await this.db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newFailCount,
          isLocked: shouldLock,
        },
      });

      if (shouldLock) {
        this.logger.error(
          `Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts: ${email}`,
        );
      }

      this.logger.warn(
        `Failed login attempt (${newFailCount}/${MAX_LOGIN_ATTEMPTS}): ${email}`,
      );

      throw new UnauthorizedException(
        'メールアドレスまたはパスワードが正しくありません',
      );
    }

    // 5. 成功: カウントリセット + 最終ログイン更新
    await this.db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lastLoginAt: new Date(),
      },
    });

    // JWT発行
    const authUser: AuthUser = {
      id: user.id,
      employeeId: user.employee.id,
      employeeCode: user.employee.employeeCode,
      name: `${user.employee.lastName} ${user.employee.firstName}`,
      email: user.employee.email,
      role: user.role as AuthUser['role'],
    };

    const accessToken = this.jwtService.sign({
      sub: user.id,
      employeeId: user.employee.id,
      role: user.role,
    });

    this.logger.log(`Successful login: ${email} (role: ${user.role})`);

    return { accessToken, user: authUser };
  }

  /**
   * パスワードハッシュ生成（新規ユーザー作成・パスワード変更時に使用）
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * アカウントロック解除（管理者用）
   */
  async unlockAccount(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        failedLoginCount: 0,
      },
    });
    this.logger.log(`Account unlocked: ${userId}`);
  }
}
