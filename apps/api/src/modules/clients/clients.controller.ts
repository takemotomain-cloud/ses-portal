/**
 * Clients Controller
 *
 * クライアント（取引先）管理のREST APIエンドポイント。
 *
 * エンドポイント一覧:
 *   POST   /api/clients        — クライアント新規登録（admin/sales）
 *   GET    /api/clients        — クライアント一覧（admin/sales）
 *   GET    /api/clients/:id    — クライアント詳細（admin/sales）
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { GBizInfoService } from './gbizinfo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('クライアント管理')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly gbizInfoService: GBizInfoService,
  ) {}

  /**
   * クライアント新規登録
   */
  @Post()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'クライアント新規登録' })
  async create(
    @Body()
    body: {
      name: string;
      corporateNumber?: string;
      invoiceNumber?: string;
      postalCode?: string;
      address?: string;
      representName?: string;
      establishedDate?: string;
      capital?: string;
      websiteUrl?: string;
      industry?: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      tradeFlow?: string;
      billingEmail?: string;
      tradeStartDate?: string;
      closingDay?: number | null;
      paymentMode?: string | null;
      paymentMonths?: number | null;
      paymentDay?: number | null;
      paymentDays?: number | null;
      bankHolidayAdj?: string | null;
    },
  ) {
    return this.clientsService.create(body);
  }

  /**
   * クライアント一覧
   */
  @Get()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'クライアント一覧' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.clientsService.findAll({ page, limit, search });
  }

  /**
   * クライアント更新
   */
  @Patch(':id')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'クライアント更新' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      corporateNumber?: string;
      invoiceNumber?: string;
      postalCode?: string;
      address?: string;
      representName?: string;
      establishedDate?: string;
      capital?: string;
      websiteUrl?: string;
      industry?: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      tradeFlow?: string;
      billingEmail?: string;
      tradeStartDate?: string;
      closingDay?: number | null;
      paymentMode?: string | null;
      paymentMonths?: number | null;
      paymentDay?: number | null;
      paymentDays?: number | null;
      bankHolidayAdj?: string | null;
    },
  ) {
    return this.clientsService.update(id, body);
  }

  /**
   * gBizINFO 会社名検索
   */
  @Get('gbiz/search')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'gBizINFO 会社名検索' })
  async gbizSearch(@Query('name') name: string) {
    if (!name) return [];
    return this.gbizInfoService.searchByName(name, 10);
  }

  /**
   * gBizINFO 法人番号で取得
   */
  @Get('gbiz/:corpNumber')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'gBizINFO 法人番号取得' })
  async gbizGet(@Param('corpNumber') corpNumber: string) {
    return this.gbizInfoService.getByCorpNumber(corpNumber);
  }

  /**
   * クライアント詳細
   */
  @Get(':id')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'クライアント詳細' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }
}
