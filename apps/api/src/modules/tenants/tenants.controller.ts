import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

@Controller('system/tenants')
@UseGuards(SystemAdminGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** テナント一覧（統計付き） */
  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  /** テナント詳細 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  /** テナント新規作成 */
  @Post()
  create(
    @Body()
    body: {
      name: string;
      subdomain?: string;
      zipCode?: string;
      address?: string;
      tel?: string;
      email?: string;
      registrationNumber?: string;
      bankName?: string;
      bankBranch?: string;
      bankAccountType?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
      planType?: string;
      maxUsers?: number;
      adminLastName: string;
      adminFirstName: string;
      adminEmail: string;
      adminPassword?: string;
    },
  ) {
    return this.tenantsService.create(body);
  }

  /** テナント更新 */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      subdomain?: string;
      isActive?: boolean;
      zipCode?: string;
      address?: string;
      tel?: string;
      email?: string;
      registrationNumber?: string;
      bankName?: string;
      bankBranch?: string;
      bankAccountType?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
      planType?: string;
      maxUsers?: number;
    },
  ) {
    return this.tenantsService.update(id, body);
  }

  /** テナント有効/無効トグル */
  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.tenantsService.toggleActive(id);
  }

  /** テナント削除 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
