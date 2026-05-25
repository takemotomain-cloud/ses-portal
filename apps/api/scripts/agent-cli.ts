/**
 * Agent CLI
 *
 * 最小エージェントを CLI から動かすスクリプト。
 *
 * 使い方:
 *   cd apps/api
 *   npx ts-node scripts/agent-cli.ts "今朝のアラートを要約して"
 *   npx ts-node scripts/agent-cli.ts --agent=sales-watch "提案中で温度感が下がってそうな案件を3つ挙げて"
 *
 * 出力:
 *   [Ops Desk / 社内運用エージェント] のヘッダー + 応答テキスト + usage
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AgentsService } from '../src/modules/agents/agents.service';

interface ParsedArgs {
  agentId?: string;
  prompt: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let agentId: string | undefined;
  const promptParts: string[] = [];
  for (const a of argv) {
    if (a.startsWith('--agent=')) {
      agentId = a.slice('--agent='.length);
    } else if (a === '--help' || a === '-h') {
      printUsageAndExit(0);
    } else {
      promptParts.push(a);
    }
  }
  return { agentId, prompt: promptParts.join(' ').trim() };
}

function printUsageAndExit(code: number): never {
  // eslint-disable-next-line no-console
  console.error(
    `使い方: npx ts-node scripts/agent-cli.ts [--agent=<id>] "<プロンプト>"\n  agent: ops-desk | sales-watch | people-pulse (default: ops-desk)`,
  );
  process.exit(code);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.prompt) {
    printUsageAndExit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const svc = app.get(AgentsService);
    const result = await svc.runOnce(args.prompt, args.agentId);

    // eslint-disable-next-line no-console
    console.log(`\n[${result.agent.name} / ${result.agent.role}]`);
    // eslint-disable-next-line no-console
    console.log('-'.repeat(60));
    // eslint-disable-next-line no-console
    console.log(result.text);
    // eslint-disable-next-line no-console
    console.log('-'.repeat(60));
    if (result.usage) {
      // eslint-disable-next-line no-console
      console.log(
        `usage: in=${result.usage.input_tokens} out=${result.usage.output_tokens} model=${result.model}`,
      );
    }
  } catch (e) {
    const err = e as Error;
    // eslint-disable-next-line no-console
    console.error(`\n[ERROR] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
