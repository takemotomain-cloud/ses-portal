import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('提案メール')
@ApiBearerAuth()
@Controller('proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProposalsController {
  constructor(private readonly service: ProposalsService) {}

  /** メール送信なしで提案をDB保存 */
  @Post()
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '提案追加（メールなし）' })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      projectName?: string;
    },
  ) {
    return this.service.createWithoutEmail(user.tenantId, body);
  }

  @Post('send')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '提案メール送信' })
  async send(
    @CurrentUser() user: RequestUser,
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      toEmail: string;
      contactPerson?: string;
      customMessage?: string;
      projectName?: string;
    },
  ) {
    return this.service.send(user.tenantId, body);
  }

  /** 提案結果を更新（案件確定/不採用） */
  @Patch(':id/result')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '提案結果更新' })
  async updateResult(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { result: string },
  ) {
    return this.service.updateResult(user.tenantId, id, body.result);
  }

  /** 既存の提案（draft）に対してメール送信 */
  @Post(':id/send')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '既存提案にメール送信' })
  async sendExisting(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      toEmail: string;
      contactPerson?: string;
      customMessage?: string;
    },
  ) {
    return this.service.sendExisting(user.tenantId, id, body);
  }

  @Post('preview')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '提案メールプレビュー' })
  async preview(
    @CurrentUser() user: RequestUser,
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      contactPerson?: string;
      customMessage?: string;
    },
  ) {
    return this.service.preview(user.tenantId, body);
  }

  /**
   * 重複送信チェック（N2）
   *
   * フロントエンドは送信前にこのエンドポイントを呼び、件数があれば
   * 「過去X件の重複送信があります。本当に送信しますか？」のダイアログを表示する。
   */
  @Post('check-duplicate')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '同一クライアント・社員・案件の重複送信チェック' })
  async checkDuplicate(
    @CurrentUser() user: RequestUser,
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      projectName?: string;
    },
  ) {
    const duplicates = await this.service.findRecentSimilar(user.tenantId, body);
    return { count: duplicates.length, duplicates };
  }

  @Get('history')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: 'クライアント別送信履歴' })
  async history(
    @CurrentUser() user: RequestUser,
    @Query('clientId') clientId: string,
  ) {
    return this.service.findByClient(user.tenantId, clientId);
  }

  /**
   * 送信失敗の提案一覧（N3: 再送 UI 用）
   */
  @Get('failed')
  @Roles('admin', 'manager', 'member')
  @ApiOperation({ summary: '送信失敗した提案一覧' })
  async failed(@CurrentUser() user: RequestUser) {
    const rows = await this.service.findFailed(user.tenantId);
    return { count: rows.length, rows };
  }
}
