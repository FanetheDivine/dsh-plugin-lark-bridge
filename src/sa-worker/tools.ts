/** SA-工作会话的上报工具。 */
import { defineTool } from '@deepseek-ai/dsh-tools';

import type { LarkSuperAgentService } from '../lark-super-agent/api.ts';
import { REPORT_KINDS } from '../lark-super-agent/api.ts';
import type { Context } from '../types.ts';

export type WorkerContext = Context & { readonly larkSuperAgent: LarkSuperAgentService };

/** 注册 send_report；参数校验、存档与投递由共享服务执行。 */
export function registerWorkerTools(ctx: WorkerContext): void {
  ctx.tools.register(
    defineTool({
      name: 'send_report',
      description:
        'Send a typed report to the dispatch session for delivery to the user. The kind tells the dispatch session how to update the task.',
      parameters: {
        kind: {
          type: 'string',
          required: true,
          enum: [...REPORT_KINDS],
          description:
            'progress: a milestone or a requirement change. question: a decision the user must make. completed: the task is done. This is a very important value: send it only when the user has no follow-up instructions and no doubts about the current result. abandoned: the task is given up. Only completed and abandoned end the task. Use progress for routine reports.',
        },
        text: {
          type: 'string',
          description: 'Text or a question for the user. Required when files is empty or omitted.',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Paths to completed Markdown files to deliver. Absolute paths or paths relative to the caller working directory.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            reportId: { type: 'string', required: true },
            taskId: {
              oneOf: [{ type: 'string' }, { type: 'null' }],
              required: true,
            },
            delivered: { type: 'boolean', required: true, const: true },
            warning: {
              type: 'string',
              description: 'Non-fatal post-delivery warning, such as a commit failure.',
            },
          },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) ?? 'null' }],
      },
      execute: (args, exec) => {
        const callerSessionId = exec.agent?.session?.id;
        if (callerSessionId === undefined || callerSessionId === '') {
          throw new Error('send_report requires an agent session');
        }
        return ctx.larkSuperAgent.sendReport(
          {
            kind: args.kind,
            ...(args.text === undefined ? {} : { text: args.text }),
            ...(args.files === undefined ? {} : { files: args.files }),
          },
          callerSessionId,
        );
      },
    }),
  );
}
