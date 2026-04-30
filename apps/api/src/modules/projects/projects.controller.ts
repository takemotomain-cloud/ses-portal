import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('案件')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'member')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'クライアントの案件一覧' })
  async findByClient(@Query('clientId') clientId: string) {
    return this.projectsService.findByClient(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: '案件詳細' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '案件作成' })
  async create(@Body() body: {
    clientId: string;
    name: string;
    contractPrice?: number;
    rewardRate?: string;
    settlementLower?: number;
    settlementUpper?: number;
    overtimeRate?: number;
    deductionRate?: number;
    startDate?: string;
    endDate?: string;
    workLocation?: string;
    area?: string;
    defaultStartTime?: string;
    attendanceFormat?: string;
    clientAttendanceRequired?: boolean;
    supplyChain?: string;
    note?: string;
    closingDay?: number | null;
    paymentMode?: string | null;
    paymentMonths?: number | null;
    paymentDay?: number | null;
    paymentDays?: number | null;
    bankHolidayAdj?: string | null;
  }) {
    return this.projectsService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '案件更新' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      name?: string;
      contractPrice?: number | null;
      rewardRate?: string | null;
      settlementLower?: number | null;
      settlementUpper?: number | null;
      overtimeRate?: number | null;
      deductionRate?: number | null;
      startDate?: string | null;
      endDate?: string | null;
      workLocation?: string | null;
      area?: string | null;
      defaultStartTime?: string | null;
      attendanceFormat?: string;
      clientAttendanceRequired?: boolean;
      supplyChain?: string | null;
      note?: string | null;
      closingDay?: number | null;
      paymentMode?: string | null;
      paymentMonths?: number | null;
      paymentDay?: number | null;
      paymentDays?: number | null;
      bankHolidayAdj?: string | null;
    },
  ) {
    return this.projectsService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '案件削除（論理削除）' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.projectsService.remove(id);
    return { message: '削除しました' };
  }
}
