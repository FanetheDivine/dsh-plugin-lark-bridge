/** SA-调度会话的工具：任务维护、会话管理与工作区笔记。参数与结果的契约转换只在这里做。 */
import { defineTool, ToolArgsError } from '@deepseek-ai/dsh-tools';

import type { LarkSuperAgentService, TaskStatus } from '../lark-super-agent/api.ts';
import type { Context } from '../types.ts';

export type DispatchContext = Context & { readonly larkSuperAgent: LarkSuperAgentService };

const STATUS_VALUES: readonly TaskStatus[] = ['in_progress', 'waiting_user', 'failed'];

function renderJson(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) ?? 'null' }];
}

/** 注册任务、会话管理与工作区笔记工具。 */
export function registerDispatchTools(ctx: DispatchContext): void {
  const service = ctx.larkSuperAgent;

  ctx.tools.register(
    defineTool({
      name: 'task_update',
      description:
        'Update an unfinished task: its status, title, or messages. Ending a task needs task_end.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Existing task id.' },
        status: {
          type: 'string',
          enum: [...STATUS_VALUES],
          description:
            'in_progress after a progress report, waiting_user after a question report, failed when the session failed a turn.',
        },
        add_message: {
          type: 'object',
          additionalProperties: false,
          description: 'A follow-up, supplement, or answer to append to the task.',
          properties: {
            text: { type: 'string', required: true, description: 'Message text.' },
            message_id: { type: 'string', description: 'Optional remote message id.' },
          },
        },
        title: { type: 'string', description: 'Replacement task title.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            taskId: { type: 'string', required: true },
            status: { type: 'string', required: true, enum: [...STATUS_VALUES] },
          },
        },
        render: (_args, value) => renderJson(value),
      },
      execute: (args) => {
        if (
          args.status === undefined &&
          args.add_message === undefined &&
          args.title === undefined
        ) {
          throw new ToolArgsError([
            'task_update needs at least one of status, add_message, or title',
          ]);
        }
        return service.updateTask({
          taskId: args.task_id,
          ...(args.status === undefined ? {} : { status: args.status }),
          ...(args.title === undefined ? {} : { title: args.title }),
          ...(args.add_message === undefined
            ? {}
            : {
                addMessage: {
                  text: args.add_message.text,
                  ...(args.add_message.message_id === undefined
                    ? {}
                    : { messageId: args.add_message.message_id }),
                },
              }),
        });
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'task_end',
      description: 'End a task and archive it with its reports. The session stays unarchived.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Existing task id.' },
        reason: {
          type: 'string',
          required: true,
          enum: ['completed', 'cancelled'],
          description:
            'completed after the user confirms the task is done. cancelled when the user asks to finish or cancel it.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { taskId: { type: 'string', required: true } },
        },
        render: (_args, value) => renderJson(value),
      },
      execute: async (args) => {
        const { taskId } = await service.endTask(args.task_id, args.reason);
        return { taskId };
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'session_manage',
      description:
        'Manage an existing session: create its task so send_report and follow-ups reach the user through this session.',
      parameters: {
        session_id: { type: 'string', required: true, description: 'Existing session id.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sessionId: { type: 'string', required: true },
            taskId: { type: 'string', required: true },
            title: { type: 'string', required: true },
          },
        },
        render: (_args, value) => renderJson(value),
      },
      execute: (args, exec) => service.manageSession(args.session_id, exec.signal),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'session_unmanage',
      description: 'Stop managing a session: end its task and keep the session.',
      parameters: {
        session_id: { type: 'string', required: true, description: 'Managed session id.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sessionId: { type: 'string', required: true },
            taskId: { type: 'string', required: true },
          },
        },
        render: (_args, value) => renderJson(value),
      },
      execute: async (args) => {
        const task = await service.managedTask(args.session_id);
        if (task === undefined) {
          throw new Error(`session ${args.session_id} is not managed`);
        }
        await service.endTask(task.id, 'unmanaged');
        return { sessionId: args.session_id, taskId: task.id };
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'session_restore',
      description:
        'Restore an archived session: unarchive it, restore the task that its archive ended with its reports and task log, and pin it again. Use this instead of session_archive remove: true when the session should return as a managed task.',
      parameters: {
        session_id: { type: 'string', required: true, description: 'Archived session id.' },
        pin: {
          type: 'boolean',
          description: 'Pin the restored session again. Defaults to true.',
        },
      },
      output: {
        schema: { type: 'json' as const },
        render: (_args, value) => renderJson(value),
      },
      execute: async (args) => {
        const restored = await service.restoreSession(args.session_id, {
          pin: args.pin !== false,
        });
        return {
          sessionId: restored.sessionId,
          ...(restored.taskId === undefined ? {} : { taskId: restored.taskId }),
          taskRestored: restored.taskRestored,
          pinned: restored.pinned,
          ...(restored.warning === undefined ? {} : { warning: restored.warning }),
        };
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'workspace_note_set',
      description:
        'Create or replace a workspace note. Registered notes also authorize dispatching into that workspace.',
      parameters: {
        workspace_id: {
          type: 'string',
          required: true,
          description: 'Existing workspace id from the host workspace registry.',
        },
        summary: {
          type: 'string',
          required: true,
          description: 'Concise description of the project in this workspace.',
        },
        keywords: {
          type: 'array',
          required: true,
          items: { type: 'string' },
          description: 'Keywords used to match user tasks to this workspace.',
        },
        notes: {
          type: 'string',
          description: 'Optional additional guidance for workspace selection.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            workspaceId: { type: 'string', required: true },
            created: { type: 'boolean', required: true },
          },
        },
        render: (_args, value) => renderJson(value),
      },
      execute: (args) =>
        service.setWorkspaceNote({
          workspaceId: args.workspace_id,
          summary: args.summary,
          keywords: args.keywords,
          ...(args.notes === undefined ? {} : { notes: args.notes }),
        }),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'workspace_note_remove',
      description: 'Remove a workspace note and revoke dispatch authorization for that workspace.',
      parameters: {
        workspace_id: {
          type: 'string',
          required: true,
          description: 'Workspace id whose note should be removed.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            workspaceId: { type: 'string', required: true },
            removed: { type: 'boolean', required: true },
          },
        },
        render: (_args, value) => renderJson(value),
      },
      execute: (args) => service.removeWorkspaceNote(args.workspace_id),
    }),
  );
}
