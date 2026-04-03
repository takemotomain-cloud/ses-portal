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
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('クライアント管理')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * クライアント新規登録
   */
  @Post()
  @Roles('admin', 'sales')
  @ApiOperation({ summary: 'クライアント新規登録' })
  async create(
    @Body()
    body: {
      name: string;
      industry?: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      tradeFlow?: string;
      billingEmail?: string;
      tradeStartDate?: string;
    },
  ) {
    return this.clientsService.create(body);
  }

  /**
   * クライアント一覧
   */
  @Get()
  @Roles('admin', 'sales')
  @ApiOperation({ summary: 'クライアント一覧' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.clientsService.findAll({ page, limit, search });
  }

  /**
   * クライアント詳細
   */
  @Get(':id')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: 'クライアント詳細' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }
}
