/**
 * `send_report`：把进度或提问报给调度会话。
 * 工具对所有非调度会话可见，只有被管理会话能成功投递。
 * 描述规定送达事实与上报后的正文收尾上限，正文因此不复述上报内容。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';

import type { LarkSuperAgentService } from '../api.ts';
import { REPORT_KINDS } from '../api.ts';

/** 工具名。 */
export const SEND_REPORT_TOOL = 'send_report';

/** 描述文本，说明只在被要求时调用，并规定上报送达后的正文收尾。 */
export const SEND_REPORT_DESCRIPTION = `Report to the user. Call it only when you are asked to report; never call it on your own.

A report goes to the dispatch session, which relays it to the user and tracks this session's task. Every session except the dispatch session sees this tool, but only a session managed by the dispatch session can deliver a report; anywhere else the call fails.

Prefer a report over response text: user-facing content goes in the report's text or files. A delivered report reaches the user through the dispatch session, so the response body would be a second copy of it.

After a report, the response body holds at most one short closing line: what you do next, or what you wait for. An empty body is fine when nothing is left to add. Conclusions, file lists, commit and PR details, and questions belong in the report alone. When a report was not delivered, keep that content in the response body.

- progress: a milestone or a requirement change. The task stays in progress.
- question: a decision the user must make. The dispatch session relays it and waits for the user.

desc summarizes this task for the dispatch session, which knows only the task's first message. Update it when your understanding of the task changes.`;

/** `desc` 参数说明。 */
export const SEND_REPORT_DESC_PARAM =
  'One-line summary of this task, for the dispatch session. Omit when the task is unchanged.';

/** 构造 `send_report`；参数校验、存档与投递由共享服务执行。 */
export function buildSendReportTool(service: LarkSuperAgentService) {
  return defineTool({
    name: SEND_REPORT_TOOL,
    description: SEND_REPORT_DESCRIPTION,
    parameters: {
      kind: {
        type: 'string',
        required: true,
        enum: [...REPORT_KINDS],
        description:
          'progress: a milestone or a requirement change. question: a decision the user must make. Only the user decides that a task is finished, so a report never ends it.',
      },
      text: {
        type: 'string',
        description:
          'Text or a question for the user. Required when files is empty or omitted. This text is what the user receives, so your response body repeats none of it.',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Paths to completed Markdown files to deliver. Absolute paths or paths relative to the caller working directory.',
      },
      desc: { type: 'string', description: SEND_REPORT_DESC_PARAM },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reportId: {
            type: 'string',
            description: 'Report id; absent when the report was not archived.',
          },
          taskId: { type: 'string', required: true },
          reportPath: {
            type: 'string',
            description:
              'Report path relative to the dispatch workspace; absent when not archived.',
          },
          delivered: {
            type: 'boolean',
            required: true,
            description: 'Whether the dispatch session received the report.',
          },
          reason: {
            type: 'string',
            description: 'Why an undelivered report was not delivered.',
          },
          warning: {
            type: 'string',
            description: 'Non-fatal post-delivery warning, such as a commit failure.',
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) ?? 'null' }],
    },
    execute: async (args, exec) => {
      const callerSessionId = exec.agent?.session?.id;
      if (callerSessionId === undefined || callerSessionId === '') {
        throw new Error('send_report requires an agent session');
      }
      return service.sendReport(
        {
          kind: args.kind,
          ...(args.text === undefined ? {} : { text: args.text }),
          ...(args.files === undefined ? {} : { files: args.files }),
          ...(args.desc === undefined ? {} : { desc: args.desc }),
        },
        callerSessionId,
      );
    },
  });
}
