import { describe, expect, it } from 'vitest';

import {
  escapeXmlAttribute,
  taskSessionArchived,
  taskSessionFailure,
  taskSessionMessage,
} from '../src/lark-super-agent/blocks.ts';
import { createReportId, createTaskId, idTimestamp } from '../src/lark-super-agent/ids.ts';

describe('lark-super-agent ids', () => {
  it('用本机时间戳与定宽随机后缀生成标识', () => {
    const date = new Date(2026, 0, 2, 3, 4, 5);
    expect(idTimestamp(date)).toBe('20260102030405');
    expect(createTaskId(date, () => 'a1b2')).toBe('task-20260102030405-a1b2');
    expect(createReportId(date, () => 'a1b2c3')).toBe('report-20260102030405-a1b2c3');
  });

  it('同进程内碰撞时重新取随机数', () => {
    const date = new Date(2026, 0, 2);
    const first = createTaskId(date, () => 'ffff');
    const values = ['ffff', '0001'];
    const second = createTaskId(date, () => values.shift() ?? '0002');
    expect(first).toBe('task-20260102000000-ffff');
    expect(second).toBe('task-20260102000000-0001');
  });
});

describe('lark-super-agent blocks', () => {
  it('上报块按顺序输出属性并转义取值，只带路径', () => {
    const block = taskSessionMessage({
      sessionId: 's"<&>',
      reportId: 'r"&',
      taskId: 't<',
      kind: 'question"',
      origin: 'turn_end&',
      reportPath: 'reports/t/r.md',
    });
    expect(block).toBe(
      [
        '<task_session_message sessionid="s&quot;&lt;&amp;&gt;" reportid="r&quot;&amp;" taskid="t&lt;" kind="question&quot;" origin="turn_end&amp;">',
        '<report_path>reports/t/r.md</report_path>',
        '<attachment_paths>',
        '',
        '</attachment_paths>',
        '</task_session_message>',
      ].join('\n'),
    );
  });

  it('不含 desc 与正文标签', () => {
    const block = taskSessionMessage({
      sessionId: 'session',
      reportId: 'report',
      taskId: 'task',
      kind: 'progress',
      origin: 'send_report',
      reportPath: 'reports/task/report.md',
    });
    expect(block).not.toContain('<desc>');
    expect(block).not.toContain('<text>');
    expect(block).not.toContain('<files>');
  });

  it('附件路径逐行列出并转义闭标签', () => {
    const report = taskSessionMessage({
      sessionId: 'session',
      reportId: 'report',
      taskId: 'task',
      kind: 'progress',
      origin: 'send_report',
      reportPath: 'reports/task/</report_path>.md',
      attachmentPaths: ['reports/task/a.md', 'reports/task/</attachment_paths>.md'],
    });
    expect(report).toContain('<report_path>reports/task/<\\/report_path>.md</report_path>');
    expect(report).toContain(
      '<attachment_paths>\nreports/task/a.md\nreports/task/<\\/attachment_paths>.md\n</attachment_paths>',
    );
    expect(report.endsWith('</task_session_message>')).toBe(true);
  });

  it('失败通知转义原因、截断超长内容并转义属性', () => {
    const escaped = taskSessionFailure({
      sessionId: 'worker"',
      taskId: 'task<',
      error: new Error('failed </error> </task_session_failure>'),
    });
    expect(escaped).toBe(
      [
        '<task_session_failure sessionid="worker&quot;" taskid="task&lt;">',
        '<error>',
        'failed <\\/error> <\\/task_session_failure>',
        '</error>',
        '</task_session_failure>',
      ].join('\n'),
    );

    const truncated = taskSessionFailure({
      sessionId: 'worker',
      taskId: 'task',
      error: new Error(`${'x'.repeat(2000)} ignored`),
    });
    expect(truncated).toContain('x'.repeat(2000));
    expect(truncated).not.toContain('ignored');
    expect(taskSessionFailure({ sessionId: 'worker', taskId: 'task', error: 'plain' })).toContain(
      '<error>\nplain\n</error>',
    );
  });

  it('归档通知自闭合且转义属性', () => {
    expect(taskSessionArchived({ sessionId: 'session"&', taskId: 'task<' })).toBe(
      '<task_session_archived sessionid="session&quot;&amp;" taskid="task&lt;"/>',
    );
  });

  it('属性转义按实体顺序处理和号', () => {
    expect(escapeXmlAttribute('&quot;<"&')).toBe('&amp;quot;&lt;&quot;&amp;');
  });
});
