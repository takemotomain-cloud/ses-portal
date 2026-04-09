import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkillsheetsService } from './skillsheets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('スキルシート')
@ApiBearerAuth()
@Controller('skillsheets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SkillsheetsController {
  constructor(private readonly service: SkillsheetsService) {}

  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'スキルシート一覧（SES事業部社員）' })
  async findAll(@Query('search') search?: string) {
    return this.service.findAllWithEmployees(search);
  }

  @Get(':employeeId')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '社員スキルシート取得' })
  async findOne(@Param('employeeId') employeeId: string) {
    return this.service.findByEmployeeId(employeeId);
  }

  @Put(':employeeId')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'スキルシート保存' })
  async upsert(
    @Param('employeeId') employeeId: string,
    @Body() body: {
      experience?: string;
      selfPr?: string;
      projects?: any;
    },
  ) {
    return this.service.upsert(employeeId, body);
  }

  @Patch(':employeeId/summary')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'サマリ情報保存' })
  async saveSummary(
    @Param('employeeId') employeeId: string,
    @Body() body: {
      summaryAffiliation?: string;
      summaryMonth?: string;
      summaryRate?: string;
    },
  ) {
    return this.service.saveSummary(employeeId, body);
  }
}
