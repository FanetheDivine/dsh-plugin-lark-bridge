/**
 * `send_report` 的专用卡片：显示上报类型、任务简介、正文与附件，
 * 避免正文与上报重复展示。注册到 `tool.call.toolview` 槽位的 `send_report` 键。
 */
import { MarkdownText, Pill } from '@deepseek-ai/dsh-client-ui-primitives';

import type { BridgeKey } from './locales.ts';

/** 卡片显示的参数。 */
interface ReportArgs {
  readonly kind?: unknown;
  readonly text?: unknown;
  readonly files?: unknown;
  readonly desc?: unknown;
}

/** 本组件用到的槽位 props 子集。 */
export interface ReportCardProps {
  readonly phase: 'preparing' | 'start' | 'result';
  readonly block: {
    readonly argsRaw?: string;
    readonly content?: readonly { readonly type?: string; readonly text?: string }[];
    readonly isError?: boolean;
    readonly error?: { readonly reason?: string };
  };
  readonly t?: (key: BridgeKey, params?: Record<string, string | number>) => string;
}

const KIND_LABELS: Record<string, 'report.kind.progress' | 'report.kind.question'> = {
  progress: 'report.kind.progress',
  question: 'report.kind.question',
};

const FALLBACK = {
  'report.title': 'Report',
  'report.kind.progress': 'Progress',
  'report.kind.question': 'Question',
  'report.desc': 'Task',
  'report.files': 'Files',
  'report.delivered': 'Delivered',
  'report.failed': 'Not delivered',
} as const;

function translate(props: ReportCardProps, key: keyof typeof FALLBACK): string {
  return props.t?.(key) ?? FALLBACK[key];
}

/** 解析调用参数；准备阶段参数可能不完整。 */
function parseArgs(raw: string | undefined): ReportArgs {
  if (raw === undefined || raw === '') return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as ReportArgs) : {};
  } catch {
    return {};
  }
}

/** 结果正文里的上报编号。 */
function reportIdOf(content: readonly { type?: string; text?: string }[] | undefined): string {
  const text = (content ?? [])
    .flatMap((block) =>
      block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
    )
    .join('');
  try {
    const value = JSON.parse(text) as { reportId?: unknown };
    return typeof value.reportId === 'string' ? value.reportId : '';
  } catch {
    return '';
  }
}

/** 表格与代码围栏的固定文案；MarkdownText 要求引用稳定的对象。 */
const MARKDOWN_LABELS = {
  code: { copyLabel: 'Copy', copiedLabel: 'Copied' },
  footnotes: 'Footnotes',
};

const cardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  border: '1px solid var(--dsw-separator)',
  borderRadius: 10,
  padding: '10px 12px',
  margin: '4px 0',
};

const headStyle = { display: 'flex', alignItems: 'center', gap: 8 };
const labelStyle = { color: 'var(--dsw-text-secondary)', fontSize: 12 };
const filesStyle = { display: 'flex', flexDirection: 'column' as const, gap: 2, fontSize: 12 };

/** 渲染上报卡片。 */
export function ReportCard(props: ReportCardProps) {
  const args = parseArgs(props.block.argsRaw);
  const kind = typeof args.kind === 'string' ? args.kind : '';
  const desc = typeof args.desc === 'string' ? args.desc.trim() : '';
  const text = typeof args.text === 'string' ? args.text : '';
  const files = Array.isArray(args.files)
    ? args.files.filter((file): file is string => typeof file === 'string')
    : [];
  const reportId = props.phase === 'result' ? reportIdOf(props.block.content) : '';
  const failed = props.phase === 'result' && props.block.isError === true;

  return (
    <div style={cardStyle} data-dsh-lark-report-card={kind || 'report'}>
      <div style={headStyle}>
        <Pill>{translate(props, 'report.title')}</Pill>
        {kind === '' ? null : (
          <Pill>
            {KIND_LABELS[kind] === undefined ? kind : translate(props, KIND_LABELS[kind])}
          </Pill>
        )}
        {props.phase === 'result' ? (
          <span style={labelStyle}>
            {failed
              ? translate(props, 'report.failed')
              : `${translate(props, 'report.delivered')} ${reportId}`.trim()}
          </span>
        ) : null}
      </div>
      {desc === '' ? null : (
        <div style={labelStyle}>
          {translate(props, 'report.desc')}: {desc}
        </div>
      )}
      {text === '' ? null : <MarkdownText text={text} labels={MARKDOWN_LABELS} variant="compact" />}
      {files.length === 0 ? null : (
        <div style={filesStyle}>
          <span style={labelStyle}>{translate(props, 'report.files')}</span>
          {files.map((file) => (
            <code key={file}>{file}</code>
          ))}
        </div>
      )}
      {failed && props.block.error?.reason !== undefined ? (
        <div style={labelStyle}>{props.block.error.reason}</div>
      ) : null}
    </div>
  );
}
