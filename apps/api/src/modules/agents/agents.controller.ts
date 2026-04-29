/**
 * AgentsController
 *
 * ダッシュボード AI Agent Control Room の REST 入口（最小版）。
 *
 * POST /api/agents/:id/execute
 *   body: { prompt: string }
 *   res:  { agent, text, usage, model }
 *
 * 認証: JwtAuthGuard + RolesGuard（admin/manager/member）。既存 DashboardController と揃え。
 */

import { Body, Controller, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AgentsService, ChatTurn, RunOnceResult } from './agents.service';

class ChatTurnDto implements ChatTurn {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(20000)
  content!: string;
}

class ExecuteAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  agentIdOverride?: string;

  /** 過去の会話履歴（text のみ）。最大 20 ターン */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}

@ApiTags('AIエージェント')
@ApiBearerAuth()
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager', 'member')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post(':id/execute')
  @HttpCode(200)
  @ApiOperation({ summary: 'エージェントに単発の依頼を投げる' })
  async execute(
    @Param('id') id: string,
    @Body() dto: ExecuteAgentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<RunOnceResult> {
    const agentId = dto.agentIdOverride || id;
    return this.agentsService.runOnce(dto.prompt, agentId, dto.history, {
      employeeId: user.employeeId,
      role: user.role,
    });
  }

  @Post(':id/execute/stream')
  @ApiOperation({ summary: 'エージェントに依頼を投げて SSE で応答を流す' })
  async executeStream(
    @Param('id') id: string,
    @Body() dto: ExecuteAgentDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ): Promise<void> {
    const agentId = dto.agentIdOverride || id;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // proxy バッファリング抑制 (next.js rewrites 経由でも効くケースがある)
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    await this.agentsService.runStream(
      dto.prompt,
      agentId,
      dto.history,
      (event) => {
        if (closed) return;
        send(event);
      },
      { employeeId: user.employeeId, role: user.role },
    );

    if (!closed) res.end();
  }
}
