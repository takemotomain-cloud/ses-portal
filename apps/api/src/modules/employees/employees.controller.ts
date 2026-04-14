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
 *   POST   /api/employees       — 社員新規登録（admin）
 *   PATCH  /api/employees/:id   — 社員情報更新（admin）
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
   * アサイン未経験社員一覧（稼働管理の「新規」タブ用）
   * 注意: /unassigned は /:id より先に定義
   */
  @Get('unassigned')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'アサイン未経験社員一覧' })
  async findUnassigned() {
    return this.employeesService.findUnassigned();
  }

  /**
   * 論理削除済み社員一覧（P1 復活フロー用）
   * 注意: /deleted は /:id より先に定義
   */
  @Get('salary-grades')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '給与テーブル（等級マスタ）一覧' })
  async getSalaryGrades() {
    return this.employeesService.getSalaryGrades();
  }

  @Get('deleted')
  @Roles('admin')
  @ApiOperation({ summary: '削除済み社員一覧' })
  async findDeleted() {
    return this.employeesService.findDeleted();
  }

  /**
   * マイナンバー閲覧（T2: 監査ログ必須）
   * 注意: /:id/mynumber は /:id より先に定義
   */
  @Get(':id/mynumber')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'マイナンバー閲覧（監査ログ記録）' })
  async getMyNumber(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employeesService.getMyNumber(id, user.userId);
  }

  /**
   * 銀行口座閲覧（T2: 監査ログ必須）
   */
  @Get(':id/bank')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '銀行口座閲覧（監査ログ記録）' })
  async getBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employeesService.getBankAccount(id, user.userId);
  }

  /**
   * 社員一覧を取得
   *
   * admin/manager/member: 全社員を検索・一覧表示可能
   * employee: アクセス不可（自分の情報はGET /meを使用）
   */
  @Get()
  @Roles('admin', 'manager', 'member')
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
   * 社員を新規登録
   *
   * admin限定。Employee + Userレコードを同時作成する。
   */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '社員新規登録' })
  async create(@CurrentUser() user: RequestUser, @Body() body: {
    lastName: string;
    firstName: string;
    lastNameKana?: string;
    firstNameKana?: string;
    employeeCode?: string;
    hireDate: string;
    departmentId: string;
    employmentType?: string;
    contractType?: string;
    birthDate?: string;
    gender?: string;
    education?: string;
    schoolName?: string;
    email: string;
    phone?: string;
    postalCode?: string;
    address?: string;
    station?: string;
    baseSalary?: number;
    rewardRate?: number;
    contractHours?: number;
    fixedOvertime?: number;
    commuteStyle?: 'onetime' | 'monthly' | 'three_month' | null;
    leaveGrantMethod?: 'hire_date' | 'transferred' | null;
    transferredLeaveDays?: number;
    transferredLeaveGrantedDate?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
  }) {
    return this.employeesService.create(body, user.userId);
  }

  /**
   * 社員情報を更新
   *
   * admin限定。部分更新を許可。
   */
  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: '社員情報更新' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: {
      lastName?: string;
      firstName?: string;
      lastNameKana?: string;
      firstNameKana?: string;
      departmentId?: string;
      employmentType?: string;
      contractType?: string;
      status?: string;
      education?: string;
      schoolName?: string;
      email?: string;
      phone?: string;
      address?: string;
      birthDate?: string;
      gender?: string;
      salaryGradeId?: string | null;
      baseSalary?: number;
      rewardRate?: number;
      contractHours?: number | null;
      fixedOvertime?: number | null;
      // J1: 社員別料率上書き
      rateHealthInsurance?: number | null;
      rateEmployeePension?: number | null;
      rateEmploymentInsurance?: number | null;
      rateIncomeTax?: number | null;
      rateResidentTaxFixed?: number | null;
      commuteStyle?: 'onetime' | 'monthly' | 'three_month' | null;
      leaveGrantMethod?: 'hire_date' | 'transferred' | null;
      transferredLeaveDays?: number | null;
      transferredLeaveGrantedDate?: string | null;
      bankName?: string;
      bankBranch?: string;
      bankAccountType?: string;
      bankAccountNumber?: string;
      station?: string;
      qualifications?: any;
      hasBonus?: boolean;
      resignDate?: string | null;
    },
  ) {
    return this.employeesService.update(id, body, user.userId);
  }

  /**
   * 社員を論理削除
   *
   * admin限定。deletedAt にタイムスタンプをセットする。
   * 紐づく過去データ（勤怠・給与・アサイン）は残したまま一覧から外す。
   */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: '社員を論理削除' })
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employeesService.softDelete(id, user.userId);
  }

  /**
   * 論理削除済み社員を復活（P1）
   */
  @Post(':id/restore')
  @Roles('admin')
  @ApiOperation({ summary: '削除済み社員を復活' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employeesService.restore(id, user.userId);
  }

  /**
   * 緊急連絡先を登録
   *
   * admin限定。社員の緊急連絡先を追加する。
   */
  @Post(':id/emergency-contact')
  @Roles('admin')
  @ApiOperation({ summary: '緊急連絡先登録' })
  async createEmergencyContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name: string; relationship: string; phone: string },
  ) {
    return this.employeesService.createEmergencyContact(id, body);
  }

  // ----------------------------------------
  // 住民税（特別徴収）管理
  // ----------------------------------------

  @Get(':id/resident-taxes')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: '住民税（特別徴収）月額一覧' })
  @ApiQuery({ name: 'fiscalYear', required: true, type: Number })
  async getResidentTaxes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fiscalYear') fiscalYear: number,
  ) {
    return this.employeesService.getResidentTaxes(id, Number(fiscalYear));
  }

  @Patch(':id/resident-taxes')
  @Roles('admin')
  @ApiOperation({ summary: '住民税（特別徴収）12ヶ月分を一括保存' })
  async upsertResidentTaxes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fiscalYear: number; amounts: Record<string, number> },
  ) {
    return this.employeesService.upsertResidentTaxes(id, body.fiscalYear, body.amounts);
  }

  // ----------------------------------------
  // 扶養家族管理
  // ----------------------------------------

  @Post(':id/dependents')
  @Roles('admin')
  @ApiOperation({ summary: '扶養家族を追加' })
  async createDependent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name: string; relationship: string; birthDate: string; annualIncome?: number },
  ) {
    return this.employeesService.createDependent(id, body);
  }

  @Patch(':id/dependents/:depId')
  @Roles('admin')
  @ApiOperation({ summary: '扶養家族を更新' })
  async updateDependent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('depId', ParseUUIDPipe) depId: string,
    @Body() body: { name?: string; relationship?: string; birthDate?: string; annualIncome?: number },
  ) {
    return this.employeesService.updateDependent(id, depId, body);
  }

  @Delete(':id/dependents/:depId')
  @Roles('admin')
  @ApiOperation({ summary: '扶養家族を削除' })
  async deleteDependent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('depId', ParseUUIDPipe) depId: string,
  ) {
    return this.employeesService.deleteDependent(id, depId);
  }

  /**
   * 社員詳細を取得
   *
   * admin: 全社員の詳細を閲覧可能
   * manager/member: 閲覧可能（ただし給与情報は別API）
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
