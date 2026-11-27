// 实机测试驱动（072）：在真实宿主中验证 session_model 与 session_restore。
// 用法：在 profile 目录运行 node run-072.mjs；结果写入 results.json。
// env：RDT_REPO 必填；RDT_PROFILE_DIR 默认脚本所在目录；RDT_PROFILE 默认目录名；RDT_DSH_PKG 默认全局宿主。
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { plain } from './mock-provider-072.mjs';

const root = process.env.RDT_PROFILE_DIR ?? dirname(fileURLToPath(import.meta.url));
const REPO = process.env.RDT_REPO;
if (!REPO) throw new Error('RDT_REPO 必填');
const PLUGIN = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).name;
const dshPkg =
  process.env.RDT_DSH_PKG ??
  join(execSync('npm root -g', { encoding: 'utf8' }).trim(), '@deepseek-ai', 'dsh', 'package.json');

for (const f of ['test-sessions', 'requests.jsonl', 'results.json', 'fatal.txt'])
  rmSync(join(root, f), { recursive: true, force: true });

process.env.GIT_CONFIG_COUNT = '2';
process.env.GIT_CONFIG_KEY_0 = 'user.name';
process.env.GIT_CONFIG_VALUE_0 = 'Lark 072 Test';
process.env.GIT_CONFIG_KEY_1 = 'user.email';
process.env.GIT_CONFIG_VALUE_1 = 'lark-072@example.invalid';
// 隔离 DSH_HOME：宿主从 $DSH_HOME/profiles 找 profile，用目录联接把真实 profile 挂进去。
const home = join(root, 'home');
process.env.DSH_PROFILE = process.env.RDT_PROFILE ?? basename(root);
mkdirSync(join(home, 'profiles'), { recursive: true });
const profileLink = join(home, 'profiles', process.env.DSH_PROFILE);
if (!existsSync(profileLink)) {
  const nativeRoot = root.replaceAll('/', String.fromCharCode(92));
  execFileSync('cmd', ['/c', 'mklink', '/J', profileLink, nativeRoot], { stdio: 'ignore' });
}
process.env.DSH_HOME = home;
process.env.DSH_PROFILE_DIR = root;
process.env.DSH_TELEMETRY_DISABLED = '1';

const require = createRequire(dshPkg);
const { createUserMessage } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')));
const { createLaunchEnvironmentSnapshot } = await import(
  pathToFileURL(require.resolve('@deepseek-ai/dsh-launch-environment'))
);
const { runProfile } = await loadRunProfile(join(dirname(dshPkg), 'lib'));

async function loadRunProfile(libDir) {
  const files = readdirSync(libDir)
    .filter((f) => /^profile-boot.*\.js$/.test(f))
    .sort((a, b) => a.length - b.length);
  for (const f of files) {
    const mod = await import(pathToFileURL(join(libDir, f)));
    if (typeof mod.runProfile === 'function') return mod;
  }
  throw new Error(`${libDir} 中找不到 runProfile`);
}

const dispatchDir = join(root, 'dispatch-workspace');
const taskDir = join(root, 'task-workspace');
mkdirSync(dispatchDir, { recursive: true });
mkdirSync(taskDir, { recursive: true });
mkdirSync(join(process.env.DSH_HOME, 'lark-bridge'), { recursive: true });

/** 盘符路径转插件的 Linux 风格工作区路径。 */
function toLinuxPath(path) {
  return path
    .replaceAll('\\', '/')
    .replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

const runtime = await runProfile({
  profile: process.env.DSH_PROFILE,
  environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: process.env }]),
  patchFiles: [],
  args: ['--no-open', '--port', '0'],
});
const app = runtime.ctx;
const adapter = app.get('rdtMock');
const entry = [...app.loader.entries()].find((e) => e.options.name === PLUGIN);
const results = [];
const FIBER_ACTIVE = 2;

/** 会话事件；兼容新旧宿主。 */
const events = (agent) =>
  typeof agent.session.snapshotEvents === 'function'
    ? agent.session.snapshotEvents()
    : agent.session.events;
const typed = (agent, type) => events(agent).filter((e) => e.type === type);
const lastToolText = (agent) => {
  const results = typed(agent, 'tool/result');
  const last = results.at(-1);
  return last === undefined ? '' : plain([last.data.message]);
};
const resultPayload = (agent) => lastToolText(agent).replace(/^RDT_RESULT:/, '');

/** 发送一条用户消息并等待本轮结束。 */
async function turn(agent, text, timeout = 30000) {
  const before = adapter.calls.length;
  agent.followup(
    createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }),
  );
  let timer;
  try {
    await Promise.race([
      agent.whenIdle(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`TEST_TIMEOUT ${agent.id}`)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return adapter.calls.slice(before);
}

/** 调用预设工具：用标记让 mock 模型发出一次工具调用。 */
async function callTool(agent, name, args) {
  await turn(agent, `RDT_TOOL:${name}:${JSON.stringify(args)}`);
  return lastToolText(agent);
}

async function waitFor(predicate, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor 超时');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

const ledgerPath = join(dispatchDir, 'message-task-status.json');
const readLedger = () => {
  try {
    return JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch {
    return { version: 2, tasks: [] };
  }
};

async function check(label, fn) {
  try {
    const detail = await fn();
    results.push({ label, status: 'PASS', detail });
    console.log('PASS', label, JSON.stringify(detail ?? {}));
  } catch (e) {
    results.push({ label, status: 'FAIL', error: e?.stack ?? String(e) });
    console.error('FAIL', label, e?.stack ?? e);
  }
}

let dispatch;
let dispatchId;
let task;

try {
  await check('A1 插件装载且与仓库 dist 一致', async () => {
    assert(adapter, 'mock provider 未加载');
    assert(entry, `loader 中找不到 ${PLUGIN}`);
    assert.equal(entry.fiber.state, FIBER_ACTIVE, '插件未激活');
    const installed = join(root, 'node_modules', PLUGIN);
    const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 12);
    const sha = hash(join(installed, 'dist', 'index.mjs'));
    assert.equal(sha, hash(join(REPO, 'dist', 'index.mjs')), '加载产物与仓库 dist 不一致');
    return { sha };
  });
  if (results.at(-1)?.status !== 'PASS') throw new Error('装载失败，中止后续用例');

  await check('A2 调度会话工具表含 session_model 与 session_restore', async () => {
    const created = await app.sessionController.create({
      cwd: dispatchDir,
      agentPreset: 'sa-dispatch',
    });
    dispatchId = created.sessionId;
    const resolved = await app.sessionController.resolveAgent(dispatchId);
    assert(!('error' in resolved), '调度会话解析失败');
    dispatch = resolved.agent;
    writeFileSync(
      join(process.env.DSH_HOME, 'lark-bridge', 'state.json'),
      JSON.stringify({ workspaceRoot: toLinuxPath(dispatchDir), sessionId: dispatchId }),
    );
    const calls = await turn(dispatch, 'hello');
    const names = (calls[0]?.tools ?? []).map((t) => t.name);
    assert(names.includes('session_model'), '工具表缺少 session_model');
    assert(names.includes('session_restore'), '工具表缺少 session_restore');
    assert(names.includes('session_manage'), '工具表缺少 session_manage');
    return { preset: created.agentPreset, tools: names.length };
  });

  await check('B1 session_model 切换任务会话并从下一步生效', async () => {
    const created = await app.sessionController.create({ cwd: taskDir });
    const resolved = await app.sessionController.resolveAgent(created.sessionId);
    assert(!('error' in resolved), '任务会话解析失败');
    task = resolved.agent;
    const defaultBefore = app.get('agentDefaultModel').currentSelection();

    const text = await callTool(dispatch, 'session_model', {
      session_id: task.id,
      provider: 'mock',
      model: 'mock-model-b',
    });
    assert(text.includes(`session ${task.id}`), `工具结果未提及目标会话：${text}`);
    assert(text.includes('mock/mock-model-b'), `工具结果未给出新路由：${text}`);

    const calls = await turn(task, 'after-switch');
    assert.equal(
      calls.at(-1)?.model,
      'mock-model-b',
      `任务会话请求模型未切换：${calls.at(-1)?.model}`,
    );
    const selection = typed(task, 'model/selection').at(-1);
    assert.equal(selection?.data?.model, 'mock-model-b', '会话未记录模型选择事件');
    const defaultAfter = app.get('agentDefaultModel').currentSelection();
    assert.equal(defaultAfter?.model, defaultBefore?.model, '全局默认模型被改动');
    return { requestModel: calls.at(-1)?.model, defaultModel: defaultAfter?.model };
  });

  await check('B2 不支持的 effort 被拒绝且不改动选择', async () => {
    const text = await callTool(dispatch, 'session_model', {
      session_id: task.id,
      provider: 'mock',
      model: 'mock-model-b',
      effort: 'max',
    });
    assert(text.includes('Invalid model selection'), `未返回校验错误：${text}`);
    const calls = await turn(task, 'after-reject');
    assert.equal(calls.at(-1)?.model, 'mock-model-b', '校验失败后模型被改动');
    return { error: text.slice(0, 120) };
  });

  await check('B3 session_restore 恢复归档会话、任务与置顶', async () => {
    await callTool(dispatch, 'session_manage', { session_id: task.id });
    const taskId = JSON.parse(resultPayload(dispatch)).taskId;
    assert(taskId, 'session_manage 未返回任务');
    const registry = app.get('workspaceRegistry');
    await registry.pinSession(task.id);
    assert(registry.pinnedSessionIds.includes(task.id), '置顶未生效');

    await registry.archiveSession(task.id);
    assert(registry.archivedSessionIds.includes(task.id), '归档未生效');
    assert(!registry.pinnedSessionIds.includes(task.id), '归档后置顶仍在');
    await waitFor(() => readLedger().tasks.every((t) => t.id !== taskId));
    await dispatch.whenIdle();

    const text = await callTool(dispatch, 'session_restore', { session_id: task.id });
    assert(!registry.archivedSessionIds.includes(task.id), '会话仍在归档集合');
    assert(registry.pinnedSessionIds.includes(task.id), '置顶未恢复');
    const restored = readLedger().tasks.find((t) => t.id === taskId);
    assert(restored, `任务未恢复：${text}`);
    assert.equal(restored.sessionId, task.id);
    return { taskId, toolResult: resultPayload(dispatch).slice(0, 200) };
  });

  await check('B4 恢复后的会话可以再次上报', async () => {
    const text = await callTool(task, 'send_report', { kind: 'progress', text: '恢复后继续推进' });
    const payload = resultPayload(task);
    const value = JSON.parse(payload);
    assert.equal(value.delivered, true, `上报未送达：${text}`);
    const restored = readLedger().tasks.find((t) => t.sessionId === task.id);
    assert(restored?.reportIds.length === 1, '台账未记录上报');
    return { reportId: value.reportId, delivered: value.delivered };
  });

  await check('B5 未归档会话调用 session_restore 报错', async () => {
    const text = await callTool(dispatch, 'session_restore', { session_id: task.id });
    assert(text.includes('is not archived'), `未返回未归档错误：${text}`);
    return { error: text.slice(0, 120) };
  });

  await check('B6 省略 session_id 时切换调度会话自身', async () => {
    const text = await callTool(dispatch, 'session_model', {
      provider: 'mock',
      model: 'mock-model-b',
    });
    assert(text.includes(`session ${dispatchId}`), `未切换调用方会话：${text}`);
    const calls = await turn(dispatch, 'after-self-switch');
    assert.equal(calls.at(-1)?.model, 'mock-model-b', '调度会话请求模型未切换');
    return { requestModel: calls.at(-1)?.model };
  });

  writeFileSync(join(root, 'results.json'), JSON.stringify(results, null, 2));
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log('RDT_DONE', JSON.stringify({ pass: results.length - fail, fail }));
  await runtime.shutdown.shutdown(fail ? 1 : 0);
} catch (e) {
  console.error(e);
  writeFileSync(join(root, 'fatal.txt'), e?.stack ?? String(e));
  await check('B6 省略 session_id 时切换调度会话自身', async () => {
    const text = await callTool(dispatch, 'session_model', {
      provider: 'mock',
      model: 'mock-model-b',
    });
    assert(text.includes(`session ${dispatchId}`), `未切换调用方会话：${text}`);
    const calls = await turn(dispatch, 'after-self-switch');
    assert.equal(calls.at(-1)?.model, 'mock-model-b', '调度会话请求模型未切换');
    return { requestModel: calls.at(-1)?.model };
  });

  writeFileSync(join(root, 'results.json'), JSON.stringify(results, null, 2));
  await runtime.shutdown.shutdown(1);
}
