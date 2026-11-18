/**
 * `lark-cli` 适配层：定位可执行文件、启动子进程、解析 JSON envelope。
 * 导出 LarkCli、CliError 与 resolveLarkCli。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

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

/** 判断文件是否存在。 */
function hasFile(path: string): boolean {
  return existsSync(path);
}

/** 从包目录解析可执行文件或入口脚本。 */
function fromPackageDir(dir: string, nodePath: string): CliCommand | undefined {
  const bin = join(dir, 'bin', WINDOWS ? 'lark-cli.exe' : 'lark-cli');
  if (hasFile(bin)) return { file: bin, args: [] };
  const entry = join(dir, 'scripts', 'run.js');
  if (hasFile(entry)) return { file: nodePath, args: [entry] };
  return undefined;
}

/** 尝试解析依赖包；未安装时返回 undefined。 */
function resolvePackage(nodePath: string): CliCommand | undefined {
  try {
    const require = createRequire(import.meta.url);
    const manifest = require.resolve('@larksuite/cli/package.json');
    return fromPackageDir(dirname(manifest), nodePath);
  } catch {
    return undefined;
  }
}

/**
 * 解析 lark-cli 命令。
 * 顺序：显式路径 → `LARK_CLI` → 已安装的 npm 包 → PATH 中的包目录 → `lark-cli`。
 * @param explicit - 配置中的覆盖路径；空串表示未覆盖。
 * @param env - 环境变量；默认 `process.env`。
 * @param nodePath - 运行入口脚本时使用的 Node/Electron 路径。
 * @returns 可执行的命令与固定参数。
 */
export function resolveLarkCli(
  explicit = '',
  env: NodeJS.ProcessEnv = process.env,
  nodePath = process.execPath,
): CliCommand {
  const trimmed = explicit.trim();
  if (trimmed !== '') {
    if (/\.(c|m)?js$/i.test(trimmed)) return { file: nodePath, args: [trimmed] };
    return { file: trimmed, args: [] };
  }
  const fromEnv = String(env['LARK_CLI'] ?? '').trim();
  if (fromEnv !== '') {
    if (/\.(c|m)?js$/i.test(fromEnv)) return { file: nodePath, args: [fromEnv] };
    return { file: fromEnv, args: [] };
  }
  const packaged = resolvePackage(nodePath);
  if (packaged !== undefined) return packaged;

  const pathValue = String(env['PATH'] ?? env['Path'] ?? '');
  const directories = pathValue.split(WINDOWS ? ';' : ':').filter((item) => item !== '');
  for (const directory of directories) {
    const local = fromPackageDir(join(directory, 'node_modules', '@larksuite', 'cli'), nodePath);
    if (local !== undefined) return local;
    const direct = join(directory, WINDOWS ? 'lark-cli.exe' : 'lark-cli');
    if (hasFile(direct)) return { file: direct, args: [] };
  }
  // 常见的全局 npm 前缀，便于未安装依赖的开发环境直接使用。
  const appData = String(env['APPDATA'] ?? '').trim();
  if (appData !== '') {
    const global = fromPackageDir(
      join(appData, 'npm', 'node_modules', '@larksuite', 'cli'),
      nodePath,
    );
    if (global !== undefined) return global;
  }
  return { file: 'lark-cli', args: [] };
}

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

/** 默认运行器：直接启动可执行文件，不经 shell。 */
export const defaultRunner: CliRunner = (command, args, options) =>
  new Promise<CliResult>((resolvePromise, reject) => {
    const child = spawn(command.file, [...command.args, ...args], {
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
  /** 解析后的命令。 */
  readonly command: CliCommand;
  private readonly runner: CliRunner;
  private readonly nodePath: string;

  /**
   * @param explicit - 配置覆盖的可执行文件路径。
   * @param runner - 运行器；测试注入。
   * @param nodePath - 运行入口脚本的 Node 路径。
   */
  constructor(explicit = '', runner: CliRunner = defaultRunner, nodePath = process.execPath) {
    this.nodePath = nodePath;
    this.command = resolveLarkCli(explicit, process.env, nodePath);
    this.runner = runner;
  }

  /** 返回一份使用同一命令的新实例，用于配置热重载。 */
  /** 运行一次调用；非零退出码转为 CliError。 */
  async run(
    args: readonly string[],
    options: RunOptions & { allowFailure?: boolean } = {},
  ): Promise<CliResult> {
    const env =
      this.command.file === this.nodePath
        ? { ...(options.env ?? {}), ELECTRON_RUN_AS_NODE: '1' }
        : (options.env ?? {});
    const result = await this.runner(this.command, args, { ...options, env });
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
    const env =
      this.command.file === this.nodePath
        ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        : process.env;
    return spawn(this.command.file, [...this.command.args, ...args], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
  }
}
