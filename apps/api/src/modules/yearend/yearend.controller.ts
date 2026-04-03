import { Controller, Get, Post, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { YearendService } from './yearend.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('年末調整')
@ApiBearerAuth()
@Controller('yearend')
@UseGuards(JwtAuthGuard)
export class YearendController {
  constructor(private readonly yearendService: YearendService) {}

  @Get('status/:year')
  @ApiOperation({ summary: '自分の年末調整状況' })
  async getMyStatus(@CurrentUser() user: RequestUser, @Param('year', ParseIntPipe) year: number) {
    return this.yearendService.getMyStatus(user.employeeId, year);
  }

  @Post('submit')
  @ApiOperation({ summary: '年末調整を提出' })
  async submit(@CurrentUser() user: RequestUser, @Body() body: { fiscalYear: number; formData: any }) {
    return this.yearendService.submit(user.employeeId, body.fiscalYear, body.formData);
  }

  @Get('admin/:year')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accounting')
  @ApiOperation({ summary: '全社員の年末調整状況（管理者用）' })
  async getAllStatus(@Param('year', ParseIntPipe) year: number) {
    return this.yearendService.getAllStatus(year);
  }
}
