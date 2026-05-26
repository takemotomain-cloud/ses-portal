/**
 * AgentsService
 *
 * ダッシュボード AI Agent Control Room のバックエンド。
 * Phase A: tool use 対応（最大 5 ループ）。
 * - tool 必要なら Claude が tool_use ブロックを返す → dispatch → tool_result を投げ返す
 * - tool 不要なら end_turn で完了 → text を抽出して返す
 *
 * 後続: Phase B (履歴), Phase C (ストリーミング)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { resolveAgent, AgentPreset } from './agent-presets';
import {
  AgentToolsService,
  AgentToolContext,
  ToolCallLog,
  buildCurrentDatetimeInfo,
} from './agent-tools.service';

export interface AgentActor {
  employeeId: string;
  role: string;
  tenantId: string;
}

export interface RunOnceResult {
  agent: { id: string; name: string; role: string };
  text: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
  toolCalls?: ToolCallLog[];
}

/** 会話履歴の 1 ターン分 (text のみ。tool ループの中間ブロックは含まない) */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** ストリーミング用のイベント */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; resultPreview: string }
  | {
      type: 'done';
      agent: { id: string; name: string; role: string };
      usage: { input_tokens: number; output_tokens: number };
      model: string;
      toolCalls: ToolCallLog[];
    }
  | { type: 'error'; message: string };

const MAX_TOOL_LOOPS = 10;

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private anthropic: Anthropic | null = null;

  // 既存 business-cards / reconciliation と揃える
  private readonly model = 'claude-3-5-sonnet-20241022';

  constructor(
    private readonly config: ConfigService,
    private readonly tools: AgentToolsService,
  ) {}

  /**
   * APIキー取得（business-cards.service.ts と同パターン）
   * ConfigService → process.env → .env 直読みの 3 段フォールバック
   */
  private getApiKey(): string {
    const fromConfig = this.config.get<string>('ANTHROPIC_API_KEY');
    if (fromConfig) return fromConfig;
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '../../../../.env'),
      path.resolve(__dirname, '../../../.env'),
      path.resolve(__dirname, '../../.env'),
    ];
    for (const p of candidates) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const m = content.match(/ANTHROPIC_API_KEY="?([^"\n\r]+)"?/);
        if (m?.[1]) return m[1].trim();
      } catch {
        /* ignore */
      }
    }
    return '';
  }

  /** preset の system prompt にサーバー現在日時 + 会計年度を append したものを返す */
  private buildSystemPrompt(agent: AgentPreset): string {
    const info = buildCurrentDatetimeInfo();
    const block = [
      '---',
      `サーバー現在日時: ${info.date} (${info.weekday_ja}) / ${info.tz}`,
      `当年会計年度: ${info.fiscal_year_label} (${info.fiscal_year_start} 〜 ${info.fiscal_year_end})`,
      `当月: ${info.current_year_month} / 前月: ${info.previous_year_month} / 翌月: ${info.next_year_month}`,
      'ユーザーが「今月」「先月」「今年度」「直近〇日」「最近」など曖昧な期間表現を使った場合は、上記を基準に解釈すること。',
    ].join('\n');
    return `${agent.systemPrompt}\n\n${block}`;
  }

  private getClient(): Anthropic {
    if (this.anthropic) return this.anthropic;
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY が設定されていません。apps/api/.env に ANTHROPIC_API_KEY="sk-ant-..." を追加してください。',
      );
    }
    this.anthropic = new Anthropic({ apiKey });
    return this.anthropic;
  }

  /**
   * 単発実行: prompt を投げて応答テキストを返す。tool 必要なら自動で取得して使う。
   * history に過去の会話を渡すと、追撃質問として継続できる（Phase B）。
   */
  async runOnce(
    prompt: string,
    agentId?: string,
    history?: ChatTurn[],
    actor?: AgentActor,
  ): Promise<RunOnceResult> {
    if (!prompt || !prompt.trim()) {
      throw new Error('prompt が空です。');
    }
    const agent: AgentPreset = resolveAgent(agentId);
    const client = this.getClient();
    const toolDefs = this.tools.getToolDefinitions();
    const toolCalls: ToolCallLog[] = [];
    const ctx: AgentToolContext = {
      actorEmployeeId: actor?.employeeId ?? '',
      actorRole: actor?.role ?? 'guest',
      tenantId: actor?.tenantId ?? process.env.SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
      writeCallCount: { value: 0 },
    };

    this.logger.log(
      `agent=${agent.id} prompt.len=${prompt.length} history.len=${history?.length ?? 0} actor=${ctx.actorEmployeeId}/${ctx.actorRole}`,
    );

    // 履歴は text-only。tool_use の中間履歴は引き継がない（必要なら毎回呼び直す方針）
    const safeHistory: Anthropic.MessageParam[] = (history ?? [])
      .filter((t) => t.content && t.content.trim())
      .map((t) => ({ role: t.role, content: t.content }));

    const messages: Anthropic.MessageParam[] = [
      ...safeHistory,
      { role: 'user', content: prompt },
    ];

    let lastUsageInput = 0;
    let lastUsageOutput = 0;
    let finalText = '';

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const res = await client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: this.buildSystemPrompt(agent),
        tools: toolDefs,
        messages,
      });

      lastUsageInput += res.usage?.input_tokens ?? 0;
      lastUsageOutput += res.usage?.output_tokens ?? 0;

      if (res.stop_reason === 'tool_use') {
        // assistant ターンを履歴に積む
        messages.push({ role: 'assistant', content: res.content });

        // tool_use ブロック群を実行
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
        for (const block of res.content) {
          if (block.type !== 'tool_use') continue;
          const result = await this.tools.dispatch(block.name, block.input, ctx);
          toolCalls.push({
            name: block.name,
            input: block.input,
            resultPreview: result.length > 200 ? result.slice(0, 200) + '…' : result,
          });
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
        messages.push({ role: 'user', content: toolResultBlocks });
        continue; // 次のターンへ
      }

      // end_turn / max_tokens / stop_sequence — テキストを抽出して終了
      finalText = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    if (!finalText) {
      finalText = '（応答が空でした。tool ループの上限に達した可能性があります）';
    }

    return {
      agent: { id: agent.id, name: agent.name, role: agent.role },
      text: finalText,
      usage: { input_tokens: lastUsageInput, output_tokens: lastUsageOutput },
      model: this.model,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }

  /**
   * ストリーミング実行 (Phase C)。
   * onEvent に逐次イベントを渡す。tool ループ中はテキストデルタが流れず、
   * 最終 (end_turn) の段だけテキストが 1 文字単位で流れる。
   */
  async runStream(
    prompt: string,
    agentId: string | undefined,
    history: ChatTurn[] | undefined,
    onEvent: (event: StreamEvent) => void,
    actor?: AgentActor,
  ): Promise<void> {
    if (!prompt || !prompt.trim()) {
      onEvent({ type: 'error', message: 'prompt が空です。' });
      return;
    }
    const agent: AgentPreset = resolveAgent(agentId);
    let client: Anthropic;
    try {
      client = this.getClient();
    } catch (e) {
      onEvent({ type: 'error', message: (e as Error).message });
      return;
    }
    const toolDefs = this.tools.getToolDefinitions();
    const toolCalls: ToolCallLog[] = [];
    const ctx: AgentToolContext = {
      actorEmployeeId: actor?.employeeId ?? '',
      actorRole: actor?.role ?? 'guest',
      tenantId: actor?.tenantId ?? process.env.SYSTEM_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
      writeCallCount: { value: 0 },
    };

    this.logger.log(
      `[stream] agent=${agent.id} prompt.len=${prompt.length} history.len=${history?.length ?? 0} actor=${ctx.actorEmployeeId}/${ctx.actorRole}`,
    );

    const safeHistory: Anthropic.MessageParam[] = (history ?? [])
      .filter((t) => t.content && t.content.trim())
      .map((t) => ({ role: t.role, content: t.content }));

    const messages: Anthropic.MessageParam[] = [
      ...safeHistory,
      { role: 'user', content: prompt },
    ];

    let totalIn = 0;
    let totalOut = 0;

    try {
      for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
        const stream = client.messages.stream({
          model: this.model,
          max_tokens: 2048,
          system: this.buildSystemPrompt(agent),
          tools: toolDefs,
          messages,
        });

        // テキストデルタを SSE に流す
        stream.on('text', (delta) => {
          if (delta) onEvent({ type: 'delta', text: delta });
        });

        const final = await stream.finalMessage();
        totalIn += final.usage?.input_tokens ?? 0;
        totalOut += final.usage?.output_tokens ?? 0;

        if (final.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: final.content });
          const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type !== 'tool_use') continue;
            onEvent({ type: 'tool_use', name: block.name, input: block.input });
            const result = await this.tools.dispatch(block.name, block.input, ctx);
            const resultPreview =
              result.length > 200 ? result.slice(0, 200) + '…' : result;
            toolCalls.push({ name: block.name, input: block.input, resultPreview });
            onEvent({ type: 'tool_result', name: block.name, resultPreview });
            toolResultBlocks.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
          messages.push({ role: 'user', content: toolResultBlocks });
          continue;
        }

        // end_turn / max_tokens / stop_sequence
        break;
      }

      onEvent({
        type: 'done',
        agent: { id: agent.id, name: agent.name, role: agent.role },
        usage: { input_tokens: totalIn, output_tokens: totalOut },
        model: this.model,
        toolCalls,
      });
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`[stream] error: ${err.message}`);
      onEvent({ type: 'error', message: err.message });
    }
  }
}
