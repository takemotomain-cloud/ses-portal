import {
  Controller,
  Get,
  Post,
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

@ApiTags('提案メール')
@ApiBearerAuth()
@Controller('proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProposalsController {
  constructor(private readonly service: ProposalsService) {}

  /** メール送信なしで提案をDB保存 */
  @Post()
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '提案追加（メールなし）' })
  async create(
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      projectName?: string;
    },
  ) {
    return this.service.createWithoutEmail(body);
  }

  @Post('send')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '提案メール送信' })
  async send(
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      toEmail: string;
      contactPerson?: string;
      customMessage?: string;
    },
  ) {
    return this.service.send(body);
  }

  /** 既存の提案（draft）に対してメール送信 */
  @Post(':id/send')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '既存提案にメール送信' })
  async sendExisting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      toEmail: string;
      contactPerson?: string;
      customMessage?: string;
    },
  ) {
    return this.service.sendExisting(id, body);
  }

  @Post('preview')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: '提案メールプレビュー' })
  async preview(
    @Body() body: {
      clientId: string;
      employeeIds: string[];
      contactPerson?: string;
      customMessage?: string;
    },
  ) {
    return this.service.preview(body);
  }

  @Get('history')
  @Roles('admin', 'sales')
  @ApiOperation({ summary: 'クライアント別送信履歴' })
  async history(@Query('clientId') clientId: string) {
    return this.service.findByClient(clientId);
  }
}
