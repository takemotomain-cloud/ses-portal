/**
 * ログインリクエスト DTO
 *
 * class-validatorで入力をバリデーション。
 * ValidationPipeが自動適用するため、コントローラー側での手動チェック不要。
 *
 * セキュリティ: emailの形式チェックとpasswordの存在チェックのみ。
 * パスワードの複雑性チェックはログイン時には不要（登録/変更時にチェック）。
 */

import { IsEmail, IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'k.yamamoto@example.com', description: 'メールアドレス' })
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  @MaxLength(255, { message: 'メールアドレスが長すぎます' })
  email!: string;

  @ApiProperty({ example: 'password123', description: 'パスワード' })
  @IsString({ message: 'パスワードを入力してください' })
  @IsNotEmpty({ message: 'パスワードを入力してください' })
  @MaxLength(128, { message: 'パスワードが長すぎます' })
  password!: string;

  @ApiPropertyOptional({ example: 'testcompany', description: 'テナントサブドメイン' })
  @IsString()
  @IsOptional()
  subdomain?: string;
}
