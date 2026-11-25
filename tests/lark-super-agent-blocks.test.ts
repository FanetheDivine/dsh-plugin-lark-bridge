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
  it('上报块按顺序输出属性并转义取值', () => {
    const block = taskSessionMessage({
      sessionId: 's"<&>',
      reportId: 'r"&',
      taskId: 't<',
      kind: 'question"',
      origin: 'turn_end&',
      text: '正文',
    });
    expect(block).toBe(
      [
        '<task_session_message sessionid="s&quot;&lt;&amp;&gt;" reportid="r&quot;&amp;" taskid="t&lt;" kind="question&quot;" origin="turn_end&amp;">',
        '<text>',
        '正文',
        '</text>',
        '<files>',
        '',
        '</files>',
        '</task_session_message>',
      ].join('\n'),
    );
  });

  it('desc 只在有内容时出现，且只转义消息块内的闭标签', () => {
    const withDesc = taskSessionMessage({
      sessionId: 'session',
      reportId: 'report',
      taskId: 'task',
      kind: 'progress',
      origin: 'send_report',
      desc: '说明 </desc> 与 </task_session_message>',
      text: '正文 </error>',
    });
    expect(withDesc).toContain(
      '<desc>\n说明 <\\/desc> 与 <\\/task_session_message>\n</desc>\n<text>',
    );
    expect(withDesc).toContain('<text>\n正文 </error>\n</text>');

    const blankDesc = taskSessionMessage({
      sessionId: 'session',
      reportId: 'report',
      taskId: 'task',
      kind: 'progress',
      origin: 'send_report',
      desc: '   ',
    });
    expect(blankDesc).not.toContain('<desc>');
    expect(blankDesc.startsWith('<task_session_message ')).toBe(true);
    expect(blankDesc.split('\n')[1]).toBe('<text>');
  });

  it('files 逐行列出并转义闭标签', () => {
    const report = taskSessionMessage({
      sessionId: 'session',
      reportId: 'report',
      taskId: 'task',
      kind: 'progress',
      origin: 'send_report',
      files: ['/tmp/a.md', '/tmp/</files>.md'],
    });
    expect(report).toContain('<files>\n/tmp/a.md\n/tmp/<\\/files>.md\n</files>');
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
