/**
 * Users Controller — ロール変更 API（E: 権限・ロール定義）
 *
 * エンドポイント:
 *   PATCH /api/users/:id/role — ユーザーのロールを変更（admin 専用）
 *
 * ロール体系:
 *   admin    — 全権限（管理側ログイン）
 *   manager  — 管理側ログイン。admin/他 manager の給与不可視
 *   member   — 管理側ログイン。admin/manager/他 member の給与不可視
 *   employee — 管理側非ログイン（SES 事業部など /mypage のみ）
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('ユーザー')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** ユーザー一覧（admin / manager） */
  @Get()
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'ユーザー一覧取得（admin / manager）' })
  async findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll({ search, role });
  }

  /**
   * ロール変更（admin 専用）
   *
   * 最後の admin を降格しようとした場合は 400 を返す。
   * セルフ降格も同じチェックが走る。
   */
  @Patch(':id/role')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'ユーザーのロールを変更（admin / manager）' })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: string },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.usersService.changeRole(id, body.role, user.userId);
    return { id: result.id, role: result.role, message: 'ロールを変更しました' };
  }
}
