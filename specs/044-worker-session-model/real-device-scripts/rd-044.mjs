// 实机验证 044：调度会话创建工作会话时使用配置的模型与 effort。
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.RDT_PROFILE_DIR;
const REPO = process.env.RDT_REPO;
const dshPkg = process.env.RDT_DSH_PKG ?? join(execSync('npm root -g', { encoding: 'utf8' }).trim(), '@deepseek-ai', 'dsh', 'package.json');
for (const f of ['test-sessions', 'requests.jsonl', 'rd-results.json']) rmSync(join(root, f), { recursive: true, force: true });
const require = createRequire(dshPkg);
const { createUserMessage } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')));
const { createLaunchEnvironmentSnapshot } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-launch-environment')));
const libDir = join(dirname(dshPkg), 'lib');
let runProfile;
for (const f of readdirSync(libDir).filter((f) => /^profile-boot.*\.js$/.test(f)).sort((a, b) => a.length - b.length)) {
  const mod = await import(pathToFileURL(join(libDir, f)));
  if (typeof mod.runProfile === 'function') { runProfile = mod.runProfile; break; }
}
process.env.DSH_PROFILE = basename(root);
process.env.DSH_PROFILE_DIR = root;
process.env.DSH_TELEMETRY_DISABLED = '1';
process.env.RDT_WS_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const runtime = await runProfile({
  profile: process.env.DSH_PROFILE,
  environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: process.env }]),
  patchFiles: [],
  args: ['--no-open', '--port', '0'],
});
const app = runtime.ctx;
const results = [];
const note = (k, v) => console.log(`   ${k}:`, JSON.stringify(v));
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (e) { results.push({ name, ok: false, error: String(e?.stack ?? e) }); console.log('FAIL', name, '\n', e?.stack ?? e); }
}
const entries = [...app.loader.entries()];
console.log('entries:', entries.map((e) => e.options.name).filter((n) => /lark|meta|preset/.test(n)).join(', '));
const row = entries.find((e) => e.options.name === 'dsh-plugin-lark-bridge/lark-super-agent');
assert(row, 'lark-super-agent row missing');
const sc = app.get('sessionController');
const events = (agent) => agent.session.snapshotEvents();
const typed = (agent, type) => events(agent).filter((e) => e.type === type);
async function setWorker(patch) {
  await row.update({ config: { guiInputSetsLocal: true, larkInputSetsRemote: true, workerProvider: '', workerModel: '', workerEffort: '', ...patch } });
  await app.loader.await();
}
async function agentOf(id) { const r = await sc.resolveAgent(id); if ('error' in r) throw r.error; return r.agent; }
async function newSession(preset) { const c = await sc.create({ workspaceId: process.env.RDT_WS_ID, agentPreset: preset }); return { id: c.sessionId, agent: await agentOf(c.sessionId) }; }
async function say(agent, text, source = { kind: 'user' }, timeout = 30000) {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source }));
  await Promise.race([agent.whenIdle(), new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), timeout))]);
}
/** 会话实际使用的模型：最近一次请求头里的配置。 */
function used(agent) {
  const h = typed(agent, 'request/header').at(-1)?.data?.header?.config;
  return h ? { provider: h.provider, model: h.model, effort: h.reasoningEffort } : null;
}
const selections = (agent) => typed(agent, 'model/selection').map((e) => e.data);
/** 调度会话创建一个工作会话，返回其会话 id。 */
async function dispatchCreate(marker = 'DISPATCH_CASE') {
  const d = await newSession('sa-dispatch');
  await say(d.agent, marker);
  const text = typed(d.agent, 'tool/result').map((e) => JSON.stringify(e.data)).join('\n');
  const id = /created session (session-[0-9a-f-]{36})/.exec(text)?.[1];
  assert(id, `no created session in tool results: ${text.slice(0, 400)}`);
  return { dispatch: d, workerId: id, worker: await agentOf(id) };
}
const defaultSel = () => app.get('agentDefaultModel').currentSelection();

await check('E0 装载：预设与行配置', async () => {
  const presets = await app.get('agentPresets').list();
  note('presets', presets.map((p) => [p.id, p.broken]));
  assert(presets.some((p) => p.id === 'sa-dispatch' && !p.broken) && presets.some((p) => p.id === 'sa-worker' && !p.broken));
  note('row config', Object.keys(row.options.config ?? {}));
  note('default', defaultSel());
  assert.equal(defaultSel().model, 'mock-model');
});

const before = JSON.stringify(defaultSel());

await check('E1 未配置：调度创建的工作会话保持默认', async () => {
  await setWorker({});
  const r = await dispatchCreate();
  await say(r.worker, 'ping');
  note('worker used', used(r.worker)); note('selections', selections(r.worker));
  assert.deepEqual(selections(r.worker), []);
  assert.equal(used(r.worker).model, 'mock-model');
});

await check('E2 已配置：调度创建的工作会话使用所配模型与 effort', async () => {
  await setWorker({ workerProvider: 'mock', workerModel: 'mock-worker', workerEffort: 'high' });
  const r = await dispatchCreate();
  await say(r.worker, 'ping');
  note('worker used', used(r.worker)); note('selections', selections(r.worker));
  note('dispatch used', used(r.dispatch.agent));
  assert.deepEqual(used(r.worker), { provider: 'mock', model: 'mock-worker', effort: 'high' });
  assert.equal(used(r.dispatch.agent).model, 'mock-model', '调度会话自身不受影响');
  // 首条任务消息（WORKER_TASK）的那一轮请求即用所配模型
  const firstHeader = typed(r.worker, 'request/header')[0].data.header.config;
  assert.equal(firstHeader.model, 'mock-worker');
  assert.equal(firstHeader.reasoningEffort, 'high');
});

await check('E3 手动新建的 SA-工作会话与默认预设会话不受影响', async () => {
  const manual = await newSession('sa-worker');
  await say(manual.agent, 'ping');
  const plain = await newSession(undefined);
  await say(plain.agent, 'ping');
  note('manual used', used(manual.agent)); note('plain used', used(plain.agent));
  assert.deepEqual(selections(manual.agent), []);
  assert.equal(used(manual.agent).model, 'mock-model');
  assert.equal(used(plain.agent).model, 'mock-model');
});

await check('E3b 调度创建进行中并发手动新建的工作会话不被套用', async () => {
  const d = await newSession('sa-dispatch');
  d.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'DISPATCH_CASE' }], source: { kind: 'user' } }));
  const manual = [];
  for (let i = 0; i < 3; i++) manual.push(await newSession('sa-worker'));
  await d.agent.whenIdle();
  for (const m of manual) { await say(m.agent, 'ping'); assert.deepEqual(selections(m.agent), []); assert.equal(used(m.agent).model, 'mock-model'); }
  const text = typed(d.agent, 'tool/result').map((e) => JSON.stringify(e.data)).join('\n');
  const id = /created session (session-[0-9a-f-]{36})/.exec(text)?.[1];
  const w = await agentOf(id); await say(w, 'ping');
  note('concurrent manual selections', manual.map((m) => selections(m.agent)));
  note('dispatched worker used', used(w));
  assert.equal(used(w).model, 'mock-worker');
});

await check('E4 显式 provider/model/effort 优先', async () => {
  const r = await dispatchCreate('DISPATCH_CASE:explicit');
  await say(r.worker, 'ping');
  note('worker used', used(r.worker)); note('selections', selections(r.worker));
  assert.deepEqual(used(r.worker), { provider: 'mock', model: 'mock-other', effort: 'low' });
});

await check('E5 配置不可用（effort 不属于模型）时回退默认并记录警告', async () => {
  await setWorker({ workerProvider: 'mock', workerModel: 'mock-model', workerEffort: 'high' });
  const r = await dispatchCreate();
  await say(r.worker, 'ping');
  note('worker used', used(r.worker));
  assert.deepEqual(selections(r.worker), []);
  assert.equal(used(r.worker).model, 'mock-model');
});

await check('E6 半组配置（只有 provider）按未配置处理', async () => {
  await setWorker({ workerProvider: 'mock' });
  const r = await dispatchCreate();
  await say(r.worker, 'ping');
  assert.deepEqual(selections(r.worker), []);
  assert.equal(used(r.worker).model, 'mock-model');
});

await check('E7 全程未改默认模型', async () => {
  note('default', defaultSel());
  assert.equal(JSON.stringify(defaultSel()), before);
});

writeFileSync(join(root, 'rd-results.json'), JSON.stringify(results, null, 2));
console.log(results.filter((r) => !r.ok).length ? 'SOME FAILED' : 'ALL PASS');
if (process.env.RDT_KEEPALIVE !== '1') process.exit(results.every((r) => r.ok) ? 0 : 1);
