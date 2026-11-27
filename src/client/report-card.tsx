/**
 * `send_report` 成功上报的卡片：类型、任务简介、Markdown 正文、可打开的文件、报告编号与折叠开关。
 * 注册到 `conversation.chat.node` 的 `lark-report` 键，节点由 `report-node.ts` 产出。
 */
import {
  FileTypeIcon,
  IconChevronDownOutlineRegular,
  IconPaperPlaneOutlineRegular,
  MarkdownText,
  Tag,
  type TagTone,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { useMemo, useState } from 'react';

import './report-card.css';
import type { BridgeKey } from './locales.ts';
import type { ReportCardData } from './report-node.ts';

/** 本组件用到的槽位 props 子集。 */
export interface ReportCardProps {
  readonly node: { readonly data: ReportCardData };
  /** 打开会话中的文件；相对路径由宿主按会话工作目录解析。 */
  readonly openFile?: ((path: string) => void) | undefined;
  readonly t?: ((key: BridgeKey) => string) | undefined;
}

/** 已知类型的文案键与标签色调。 */
const KINDS: Record<string, { readonly key: BridgeKey; readonly tone: TagTone }> = {
  progress: { key: 'report.kind.progress', tone: 'info' },
  question: { key: 'report.kind.question', tone: 'warning' },
};

/** 宿主字典缺席时的英文文案。 */
const FALLBACK: Partial<Record<BridgeKey, string>> = {
  'report.title': 'Report',
  'report.kind.progress': 'Progress',
  'report.kind.question': 'Question',
  'report.desc': 'Task',
  'report.files': 'Files',
  'report.delivered': 'Delivered',
  'report.collapse': 'Collapse',
  'report.expand': 'Expand',
  'report.copy': 'Copy',
  'report.copied': 'Copied',
  'report.footnotes': 'Footnotes',
  'report.openFile': 'Open',
};

/** 取文案；翻译座缺失或返回空值时用英文回退。 */
function translate(t: ReportCardProps['t'], key: BridgeKey): string {
  const resolved = t?.(key);
  if (typeof resolved === 'string' && resolved !== '' && resolved !== key) return resolved;
  return FALLBACK[key] ?? key;
}

/** 文件名：路径的最后一段。 */
function baseName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? path;
}

/** 渲染上报卡片，默认展开，头部提供折叠/展开开关。 */
export function ReportCard({ node, openFile, t }: ReportCardProps) {
  const { kind, desc, text, files, reportId } = node.data;
  const [expanded, setExpanded] = useState(true);
  const known = KINDS[kind];
  const toggleLabel = translate(t, expanded ? 'report.collapse' : 'report.expand');
  const labels = useMemo(
    () => ({
      code: { copyLabel: translate(t, 'report.copy'), copiedLabel: translate(t, 'report.copied') },
      footnotes: translate(t, 'report.footnotes'),
    }),
    [t],
  );
  return (
    <section
      className="dsh-lark-report"
      data-dsh-lark-report-card={kind || 'report'}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <header className="dsh-lark-report-head">
        <span className="dsh-lark-report-icon" aria-hidden>
          <IconPaperPlaneOutlineRegular size={14} />
        </span>
        <span className="dsh-lark-report-title">{translate(t, 'report.title')}</span>
        {kind === '' ? null : (
          <Tag tone={known?.tone ?? 'neutral'}>
            {known === undefined ? kind : translate(t, known.key)}
          </Tag>
        )}
        {!expanded && desc !== '' ? (
          <span className="dsh-lark-report-head-desc" title={desc}>
            {desc}
          </span>
        ) : null}
        <span className="dsh-lark-report-receipt">
          {translate(t, 'report.delivered')}
          {reportId === '' ? null : <span className="dsh-lark-report-id">{reportId}</span>}
        </span>
        <button
          type="button"
          className="dsh-lark-report-toggle"
          data-dsh-lark-report-toggle=""
          aria-expanded={expanded}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => setExpanded((previous) => !previous)}
        >
          <span className="dsh-lark-report-toggle-text">{toggleLabel}</span>
          <IconChevronDownOutlineRegular size={12} className="dsh-lark-report-toggle-icon" />
        </button>
      </header>
      {!expanded || desc === '' ? null : (
        <div className="dsh-lark-report-desc">
          <span className="dsh-lark-report-label">{translate(t, 'report.desc')}</span>
          <span className="dsh-lark-report-desc-text">{desc}</span>
        </div>
      )}
      {!expanded || text === '' ? null : (
        <div className="dsh-lark-report-body">
          <MarkdownText text={text} labels={labels} variant="compact" />
        </div>
      )}
      {!expanded || files.length === 0 ? null : (
        <div className="dsh-lark-report-files">
          <div className="dsh-lark-report-label">{translate(t, 'report.files')}</div>
          <ul>
            {files.map((file) => (
              <li key={file}>
                <button
                  type="button"
                  className="dsh-lark-report-file"
                  title={file}
                  aria-label={`${translate(t, 'report.openFile')} ${file}`}
                  disabled={openFile === undefined}
                  onClick={() => openFile?.(file)}
                >
                  <FileTypeIcon path={file} size={16} />
                  <span className="dsh-lark-report-file-name">{baseName(file)}</span>
                  <span className="dsh-lark-report-file-path">{file}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
