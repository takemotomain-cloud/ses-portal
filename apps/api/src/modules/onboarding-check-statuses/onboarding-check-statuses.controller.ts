import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { OnboardingCheckStatusesService } from './onboarding-check-statuses.service';

@ApiTags('入社チェック')
@ApiBearerAuth()
@Controller('onboarding-check-statuses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'member')
export class OnboardingCheckStatusesController {
  constructor(private readonly service: OnboardingCheckStatusesService) {}

  @Get(':employeeId')
  @ApiOperation({ summary: '社員の入社チェック確認記録一覧' })
  async list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listByEmployee(employeeId);
  }

  @Put(':employeeId/:itemKey')
  @ApiOperation({ summary: '入社チェック項目を手動で確認済みにする' })
  async upsert(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('itemKey') itemKey: string,
    @Body() body: { method?: string; confirmedAt?: string; memo?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.upsertManualStatus({
      employeeId,
      itemKey,
      method: body.method,
      confirmedAt: body.confirmedAt,
      memo: body.memo,
      confirmedBy: user.employeeId,
    });
  }

  @Delete(':employeeId/:itemKey')
  @ApiOperation({ summary: '入社チェック項目の手動確認記録を解除' })
  async clear(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('itemKey') itemKey: string,
  ) {
    return this.service.clearManualStatus(employeeId, itemKey);
  }
}
