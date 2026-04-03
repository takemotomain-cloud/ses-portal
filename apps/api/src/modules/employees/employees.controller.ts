/**
 * Employees Controller
 *
 * 社員管理のREST APIエンドポイント。
 * 全エンドポイントにJwtAuthGuardを適用し、認証必須。
 * 管理者限定の操作はRolesGuardで制御。
 *
 * エンドポイント一覧:
 *   GET    /api/employees       — 社員一覧（admin/sales: 全員, employee: 自分のみ）
 *   GET    /api/employees/:id   — 社員詳細
 *   GET    /api/employees/me    — ログインユーザー自身の情報
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('社員管理')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /**
   * 自分自身の社員情報を取得
   *
   * 全ロールで使用可能。社員マイページのプロフィール表示用。
   * 注意: /me は /:id より先に定義（ルーティングの優先順位）
   */
  @Get('me')
  @ApiOperation({ summary: '自分の社員情報を取得' })
  async getMe(@CurrentUser() user: RequestUser) {
    return this.employeesService.findOne(user.employeeId);
  }

  /**
   * 社員一覧を取得
   *
   * admin/sales: 全社員を検索・一覧表示可能
   * employee: アクセス不可（自分の情報はGET /meを使用）
   */
  @Get()
  @Roles('admin', 'sales', 'accounting')
  @ApiOperation({ summary: '社員一覧' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.employeesService.findAll({ page, limit, search, status });
  }

  /**
   * 社員詳細を取得
   *
   * admin: 全社員の詳細を閲覧可能
   * sales/accounting: 閲覧可能（ただし給与情報は別API）
   * employee: 自分のIDのみアクセス可能
   */
  @Get(':id')
  @ApiOperation({ summary: '社員詳細' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    // employeeロールは自分の情報のみアクセス可能
    if (user.role === 'employee' && user.employeeId !== id) {
      throw new ForbiddenException('他の社員の情報にはアクセスできません');
    }

    return this.employeesService.findOne(id);
  }
}
