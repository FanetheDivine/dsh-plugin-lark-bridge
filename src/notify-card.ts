/**
 * 飞书通知卡片：生成带总结句、默认收起完整 Markdown 的 Card 2.0，并按体积拆成多张。
 * 导出 CARD_BYTE_LIMIT、CardInput 与 buildCards。
 */

/** 单张卡片 JSON 的字节上限；飞书为 30 KB，留出转义膨胀的余量。 */
export const CARD_BYTE_LIMIT = 28_000;

/** 总结句的最大字符数。 */
const SUMMARY_MAX_CHARS = 200;

/** 面板标题。 */
const PANEL_TITLE = '展开完整内容';

/** 卡片输入。 */
export interface CardInput {
  /** 一句总结，常显在标题。 */
  readonly summary: string;
  /** 完整 Markdown，放进默认收起的折叠面板。 */
  readonly markdown: string;
  /** 所属任务的显示名「<title> (<task id>)」；有值时写在副标题。 */
  readonly taskLabel?: string;
}

/** 总结句压成单行并限制长度。 */
function oneLine(summary: string): string {
  const flat = summary.replace(/\s+/g, ' ').trim();
  return flat.length > SUMMARY_MAX_CHARS ? `${flat.slice(0, SUMMARY_MAX_CHARS - 1)}…` : flat;
}

/** 生成一张卡片对象。 */
function cardOf(
  title: string,
  taskLabel: string | undefined,
  markdown: string,
): Record<string, unknown> {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'default' },
    header: {
      title: { tag: 'plain_text', content: title },
      ...(taskLabel === undefined ? {} : { subtitle: { tag: 'plain_text', content: taskLabel } }),
      template: 'blue',
    },
    body: {
      elements: [
        {
          tag: 'collapsible_panel',
          expanded: false,
          header: { title: { tag: 'plain_text', content: PANEL_TITLE } },
          elements: [{ tag: 'markdown', content: markdown }],
        },
      ],
    },
  };
}

/** 一段文本放进 JSON 字符串后占用的字节数（不含引号）。 */
function encodedBytes(text: string): number {
  return Buffer.byteLength(JSON.stringify(text), 'utf8') - 2;
}

/** 按码点切分一段文本，使每片编码后不超过预算。 */
function splitByBudget(text: string, budget: number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const char of text) {
    if (current !== '' && encodedBytes(current + char) > budget) {
      pieces.push(current);
      current = '';
    }
    current += char;
  }
  if (current !== '') pieces.push(current);
  return pieces;
}

/** 把超过预算的段落先按行、再按字符切成不超预算的片。 */
function splitParagraph(paragraph: string, budget: number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const line of paragraph.split('\n')) {
    const candidate = current === '' ? line : `${current}\n${line}`;
    if (encodedBytes(candidate) <= budget) {
      current = candidate;
      continue;
    }
    if (current !== '') pieces.push(current);
    if (encodedBytes(line) <= budget) {
      current = line;
    } else {
      const parts = splitByBudget(line, budget);
      current = parts.pop() ?? '';
      pieces.push(...parts);
    }
  }
  if (current !== '') pieces.push(current);
  return pieces;
}

/** 在段落边界贪心装箱，返回每张卡片的 Markdown。 */
function pack(markdown: string, budget: number): string[] {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .flatMap((paragraph) =>
      encodedBytes(paragraph) <= budget ? [paragraph] : splitParagraph(paragraph, budget),
    );
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const candidate = current === '' ? paragraph : `${current}\n\n${paragraph}`;
    if (current !== '' && encodedBytes(candidate) > budget) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current !== '') chunks.push(current);
  return chunks.length === 0 ? [''] : chunks;
}

/**
 * 生成通知卡片；内容超过单张上限时在段落边界拆成多张，标题带序号。
 * @param input - 总结句、完整 Markdown 与可选任务名。
 * @returns 按发送顺序排列的卡片对象，每张编码后不超过 CARD_BYTE_LIMIT。
 */
export function buildCards(input: CardInput): Record<string, unknown>[] {
  const summary = oneLine(input.summary);
  const reserved = Buffer.byteLength(
    JSON.stringify(cardOf(`${summary}（999/999）`, input.taskLabel, '')),
    'utf8',
  );
  const budget = Math.max(1000, CARD_BYTE_LIMIT - reserved);
  const chunks = pack(input.markdown, budget);
  return chunks.map((chunk, index) =>
    cardOf(
      chunks.length === 1 ? summary : `${summary}（${index + 1}/${chunks.length}）`,
      input.taskLabel,
      chunk,
    ),
  );
}
