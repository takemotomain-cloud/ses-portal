/**
 * Profile Controller
 *
 * エンドポイント:
 *   GET  /api/profile             — 個人情報取得
 *   POST /api/profile/address     — 住所変更申請
 *   POST /api/profile/bank        — 口座変更申請
 *   POST /api/profile/password    — パスワード変更
 */

import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('個人情報')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: '個人情報を取得' })
  async getProfile(@CurrentUser() user: RequestUser) {
    return this.profileService.getProfile(user.employeeId);
  }

  @Post('address')
  @ApiOperation({ summary: '住所変更申請' })
  async requestAddressChange(
    @CurrentUser() user: RequestUser,
    @Body() body: { postalCode: string; address: string; moveDate?: string },
  ) {
    return this.profileService.requestAddressChange(user.employeeId, body);
  }

  @Post('bank')
  @ApiOperation({ summary: '口座変更申請' })
  async requestBankChange(
    @CurrentUser() user: RequestUser,
    @Body() body: { bankName: string; bankBranch: string; bankAccountType: string; bankAccountNumber: string; bankAccountHolder: string },
  ) {
    return this.profileService.requestBankChange(user.employeeId, body);
  }

  @Post('password')
  @ApiOperation({ summary: 'パスワード変更' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.profileService.changePassword(user.userId, body.currentPassword, body.newPassword);
    return { message: 'パスワードを変更しました' };
  }

  @Get('change-requests/pending')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '承認待ち変更申請一覧（管理者用）' })
  async getPendingChangeRequests() {
    return this.profileService.getPendingChangeRequests();
  }

  @Post('change-requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '変更申請を承認' })
  async approveChangeRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.profileService.approveChangeRequest(id, user.employeeId);
    return { message: '承認しました' };
  }

  @Post('change-requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '変更申請を却下' })
  async rejectChangeRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.profileService.rejectChangeRequest(id, user.employeeId);
    return { message: '却下しました' };
  }
}
