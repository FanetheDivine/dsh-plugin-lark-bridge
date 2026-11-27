// 实机测试 mock provider：按用户消息中的 RDT_TOOL 标记调用被测工具，再把工具结果作为回复。
// 模型：mock-model、mock-model-b（均不声明 reasoning effort，用于验证 effort 校验）。
// 每次请求都追加到 profile 目录的 requests.jsonl。
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = process.env.RDT_PROFILE_DIR ?? dirname(fileURLToPath(import.meta.url));
const dshPkg =
  process.env.RDT_DSH_PKG ??
  join(execSync('npm root -g', { encoding: 'utf8' }).trim(), '@deepseek-ai', 'dsh', 'package.json');
const require = createRequire(dshPkg);
const { LlmAdapter } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')));

export const name = 'rdt-mock-072';
export const inject = ['llm'];

/** 模型标识。 */
export const MODELS = ['mock-model', 'mock-model-b'];

function blockTexts(content) {
  return (content ?? []).flatMap((b) =>
    b.type === 'text' ? [b.text ?? ''] : b.type === 'tool-result' ? blockTexts(b.content) : [],
  );
}

export function plain(messages) {
  return messages
    .filter(Boolean)
    .flatMap((m) => blockTexts(m.content))
    .join('\n');
}

export function apply(ctx) {
  class Mock extends LlmAdapter {
    calls = [];
    providerInfo(id) {
      return { id, name: 'Real device test mock 072' };
    }
    async listModels(provider) {
      return MODELS.map((model) => ({
        provider,
        id: model,
        name: model,
        inputModalities: ['text'],
      }));
    }
    async resolveModel(provider, model) {
      return {
        provider,
        id: model,
        name: model,
        inputModalities: ['text'],
        context: { contextWindow: 200_000 },
      };
    }
    async *stream(o) {
      if (o.signal?.aborted) {
        yield {
          type: 'finish',
          reason: { kind: 'aborted', failure: { message: 'aborted', code: 'ABORTED' } },
        };
        return;
      }
      this.calls.push(o);
      try {
        appendFileSync(
          join(root, 'requests.jsonl'),
          `${JSON.stringify(o, (k, v) => (k === 'signal' ? undefined : v))}\n`,
        );
      } catch {
        // 记录失败不影响响应
      }
      const usage = (out) => ({
        type: 'usage',
        usage: { inputTokens: Math.ceil(plain(o.messages).length / 4) + 1, outputTokens: out },
      });
      const last = o.messages.at(-1);
      const hasToolResult =
        last?.role === 'tool' || (last?.content ?? []).some((b) => b.type === 'tool-result');
      if (hasToolResult) {
        const text = `RDT_RESULT:${plain([last])}`;
        yield { type: 'block-end', index: 0, block: { type: 'text', text } };
        yield usage(text.length);
        yield { type: 'finish', reason: { kind: 'stop' } };
        return;
      }
      const lastAssistant = o.messages.map((m) => m.role).lastIndexOf('assistant');
      const userText = plain(o.messages.slice(lastAssistant + 1).filter((m) => m.role === 'user'));
      const marker = /RDT_TOOL:([a-zA-Z_]+):(.+)/.exec(userText);
      if (marker) {
        const [, toolName, payload] = marker;
        if ((o.tools ?? []).some((t) => t.name === toolName)) {
          yield {
            type: 'block-end',
            index: 0,
            block: {
              type: 'tool-call',
              id: `mock-${this.calls.length}`,
              name: toolName,
              arguments: payload.trim(),
            },
          };
          yield usage(20);
          yield { type: 'finish', reason: { kind: 'tool-calls' } };
          return;
        }
        const text = `RDT_RESULT:tool ${toolName} is unavailable`;
        yield { type: 'block-end', index: 0, block: { type: 'text', text } };
        yield usage(text.length);
        yield { type: 'finish', reason: { kind: 'stop' } };
        return;
      }
      const text = 'mock：已收到';
      yield { type: 'block-end', index: 0, block: { type: 'text', text } };
      yield usage(text.length);
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  const adapter = new Mock();
  ctx.llm.registerAdapter(['mock'], adapter);
  ctx.provide('rdtMock', adapter);
}
