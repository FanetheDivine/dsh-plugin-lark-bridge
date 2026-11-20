/**
 * `lark-cli` 适配层：调用本机命令、管理子进程、解析 JSON envelope。
 * 导出 LarkCli、CliError 与进程构造辅助函数。
 */
import { type SpawnOptions, spawn } from 'node:child_process';

import { describeError } from './utils.ts';

/** 可执行文件与参数。 */
export interface CliCommand {
  /** 可执行文件。 */
  readonly file: string;
  /** 固定前缀参数。 */
  readonly args: readonly string[];
}

/** 一次调用的结果。 */
export interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

/** CLI 调用失败。 */
export class CliError extends Error {
  /** 稳定错误码。 */
  readonly code: string;
  /** 子进程退出码；未启动时为 -1。 */
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = -1) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

/** 归一化后的进程启动参数。 */
export interface SpawnSpec {
  readonly file: string;
  readonly args: readonly string[];
  readonly shell: boolean;
}

/** Windows 命令字符串只允许不需要转义的安全 token。 */
const WINDOWS_SAFE_TOKEN = /^[A-Za-z0-9._:+-]+$/;

/** 构造进程参数；Windows 用安全 token 组成单一命令字符串。 */
export function createSpawnSpec(
  command: CliCommand,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): SpawnSpec {
  const tokens = [command.file, ...command.args, ...args];
  if (platform !== 'win32') {
    return { file: command.file, args: [...command.args, ...args], shell: false };
  }
  for (const token of tokens) {
    if (token === '' || !WINDOWS_SAFE_TOKEN.test(token)) {
      throw new CliError('unsafe-arg', 'lark-cli argument contains unsupported Windows characters');
    }
  }
  return { file: tokens.join(' '), args: [], shell: true };
}

/** 启动 CLI 子进程，并把同步启动异常归一化为 CliError。 */
export function createCliProcess(
  command: CliCommand,
  args: readonly string[],
  options: SpawnOptions,
  platform: NodeJS.Platform = process.platform,
  spawnFn: typeof spawn = spawn,
): ReturnType<typeof spawn> {
  const spec = createSpawnSpec(command, args, platform);
  try {
    return spec.shell
      ? spawnFn(spec.file, { ...options, shell: true })
      : spawnFn(spec.file, [...spec.args], { ...options, shell: false });
  } catch (error) {
    throw new CliError('spawn-failed', describeError(error));
  }
}

/** 启动一次 CLI 的选项。 */
export interface RunOptions {
  /** 写入 stdin 的文本；调用会关闭 stdin。 */
  readonly input?: string;
  /** 超时毫秒数，默认 120 秒。 */
  readonly timeoutMs?: number;
  /** 追加的环境变量。 */
  readonly env?: NodeJS.ProcessEnv;
}

/** 运行器的注入点，测试用它替代真实子进程。 */
export type CliRunner = (
  command: CliCommand,
  args: readonly string[],
  options: RunOptions & { readonly keepStdinOpen?: boolean },
) => Promise<CliResult>;

const WINDOWS = process.platform === 'win32';
const TIMEOUT_DEFAULT = 120_000;
const VIEWPORT = 10 * 1024 * 1024;

/** 杀掉子进程及其后代。 */
export function killChildTree(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined) {
    child.kill();
    return;
  }
  if (WINDOWS) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      return;
    } catch {
      child.kill();
      return;
    }
  }
  child.kill('SIGTERM');
}

/** 默认运行器：按平台安全调用本机命令。 */
export const defaultRunner: CliRunner = (command, args, options) =>
  new Promise<CliResult>((resolvePromise, reject) => {
    const child = createCliProcess(command, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env ?? {}) },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: CliResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      killChildTree(child);
      fail(
        new CliError(
          'timeout',
          `lark-cli timed out after ${options.timeoutMs ?? TIMEOUT_DEFAULT}ms`,
        ),
      );
    }, options.timeoutMs ?? TIMEOUT_DEFAULT);
    timer.unref?.();
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > VIEWPORT) stdout = stdout.slice(-VIEWPORT);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > VIEWPORT) stderr = stderr.slice(-VIEWPORT);
    });
    child.on('error', (error) => {
      fail(new CliError('spawn-failed', describeError(error)));
    });
    child.on('close', (code) => finish({ stdout, stderr, code: code ?? -1 }));
    if (options.keepStdinOpen !== true) {
      if (options.input !== undefined) child.stdin?.write(options.input);
      child.stdin?.end();
    } else if (options.input !== undefined) {
      child.stdin?.write(options.input);
    }
  });

/** 解析 `{ok,data}` envelope；`ok:false` 抛出 CliError。 */
export function unwrapJson(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  if (record['ok'] === false) {
    const error = record['error'];
    const message =
      typeof error === 'object' &&
      error !== null &&
      typeof (error as Record<string, unknown>)['message'] === 'string'
        ? String((error as Record<string, unknown>)['message'])
        : JSON.stringify(error ?? record);
    throw new CliError('cli-error', message);
  }
  return record['data'] ?? value;
}

/** 把 CLI 的 JSON 文本解析并解包。 */
export function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new CliError(
      'invalid-json',
      `lark-cli returned non-JSON output: ${trimmed.slice(0, 200)}`,
    );
  }
  return unwrapJson(parsed);
}

/** 面向插件的 CLI 封装。 */
export class LarkCli {
  /** 固定的本机命令。 */
  readonly command: CliCommand = { file: 'lark-cli', args: [] };
  private readonly runner: CliRunner;

  /** @param runner - 运行器；测试注入。 */
  constructor(runner: CliRunner = defaultRunner) {
    this.runner = runner;
  }

  /** 运行一次调用；非零退出码转为 CliError。 */
  async run(
    args: readonly string[],
    options: RunOptions & { allowFailure?: boolean } = {},
  ): Promise<CliResult> {
    const result = await this.runner(this.command, args, options);
    if (result.code !== 0 && options.allowFailure !== true) {
      const detail =
        result.stderr.trim() !== ''
          ? result.stderr.trim()
          : result.stdout.trim() !== ''
            ? result.stdout.trim()
            : `exit ${result.code}`;
      throw new CliError(
        'exit',
        `lark-cli ${args.join(' ')} failed: ${detail.slice(0, 800)}`,
        result.code,
      );
    }
    return result;
  }

  /** 运行并解析 JSON 输出；调用方自行带上 `--json` 或 `--format json`。 */
  async json(args: readonly string[], options: RunOptions = {}): Promise<unknown> {
    const result = await this.run(args, options);
    return parseJsonOutput(result.stdout);
  }

  /**
   * 启动长驻子进程（事件消费）。
   * @param args - 子命令参数。
   * @returns 子进程与 stdout/stderr 读取器。
   */
  spawn(args: readonly string[]): ReturnType<typeof spawn> {
    return createCliProcess(this.command, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
  }
}
