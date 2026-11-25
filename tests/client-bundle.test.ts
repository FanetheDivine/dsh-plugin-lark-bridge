// 前端产物契约测试：执行 dist/client.js，断言闭包工厂按包名注册并导出 inject 与 apply。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { makeClientCtx } from './helpers.ts';
import { assertFreshDist } from './support/dist-freshness.ts';

/** 仓库根目录（tests/ 的上一级）。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 前端产物路径。 */
const CLIENT_FILE = path.join(ROOT, 'dist', 'client.js');

/** 浏览器产物注册 id，与 package.json 的 name 一致。 */
const CLIENT_ID = 'dsh-plugin-lark-bridge';

/** 一条产物注册。 */
interface ClientRegistration {
  id: string;
  factory: (require: (id: string) => unknown) => Record<string, unknown>;
}

/** 在桩 window 中执行产物，返回注册列表。 */
function loadRegistrations(): ClientRegistration[] {
  const code = readFileSync(CLIENT_FILE, 'utf8');
  const registrations: ClientRegistration[] = [];
  vm.runInNewContext(code, {
    window: {
      __ModuleLoader__: {
        load: (registration: ClientRegistration) => {
          registrations.push(registration);
        },
      },
    },
    // 内联的第三方组件在模块作用域读取构建期环境与浏览器语言。
    process: { env: { NODE_ENV: 'production' } },
    navigator: { language: 'zh-CN', languages: ['zh-CN'] },
  });
  return registrations;
}

/** 取出产物里内联的样式文本。 */
function inlinedCss(): string {
  const js = readFileSync(CLIENT_FILE, 'utf8');
  const match = js.match(/style\.textContent = (".*?"); document\.head/s);
  if (match?.[1] === undefined) throw new Error('产物没有内联样式');
  return JSON.parse(match[1]) as string;
}

describe('前端产物（dist/client.js）', () => {
  it('按包名注册闭包工厂，导出 inject 与 apply', () => {
    assertFreshDist();
    const registrations = loadRegistrations();
    expect(registrations).toHaveLength(1);
    const registration = registrations[0];
    expect(registration?.id).toBe(CLIENT_ID);

    const jsxStub = () => null;
    const reactStub = {
      Fragment: 'Fragment',
      useState: (value: unknown) => [value, () => undefined],
      useEffect: () => undefined,
      useLayoutEffect: () => undefined,
      useCallback: (fn: unknown) => fn,
      useMemo: (fn: () => unknown) => fn(),
      useRef: (value: unknown) => ({ current: value }),
      useId: () => ':r0:',
      // 内联的第三方组件在模块作用域创建记忆组件与 context。
      memo: (component: unknown) => component,
      forwardRef: (render: unknown) => render,
      createContext: (value: unknown) => ({ Provider: 'Provider', Consumer: 'Consumer', value }),
      useContext: () => undefined,
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      createElement: jsxStub,
    };
    const reactDomStub = {
      createPortal: (node: unknown) => node,
      flushSync: (run: () => void) => run(),
    };
    const storeStub = {
      createSnapshotStore: (initial: unknown) => ({
        getSnapshot: () => initial,
        subscribe: () => () => undefined,
        update: () => undefined,
        set: () => undefined,
      }),
    };
    /** 平台组件桩：产物只在 apply 里构造表单模型，不渲染组件。 */
    const primitivesStub = {
      SettingsFormModel: class {
        bind(project: () => unknown) {
          return { getSnapshot: project, subscribe: () => () => undefined };
        }
        shell() {
          return {
            available: true,
            writable: true,
            dirty: false,
            invalid: false,
            saving: false,
            failed: false,
          };
        }
        field() {
          return { text: '', overridden: false, invalid: false };
        }
        actions() {
          return {
            edit: () => undefined,
            resetField: () => undefined,
            save: () => undefined,
            discard: () => undefined,
          };
        }
        dispose() {}
      },
      SettingsForm: jsxStub,
      SettingsValueField: jsxStub,
      Switch: jsxStub,
      Menu: jsxStub,
      IconChevronDownOutlineRegular: jsxStub,
      IconClockOutlineRegular: jsxStub,
      IconCloseOutlineRegular: jsxStub,
      IconPlusOutlineRegular: jsxStub,
      Pill: jsxStub,
      Modal: jsxStub,
      Checkbox: jsxStub,
      Button: jsxStub,
      Toast: jsxStub,
      settingsTextField: (field: string) => ({
        field,
        format: () => '',
        parse: () => ({ kind: 'clear' }),
      }),
    };
    const exported = registration?.factory((id) => {
      if (id === 'react') return reactStub;
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub;
      if (id === 'react-dom') return reactDomStub;
      if (id === '@deepseek-ai/dsh-client-store') return storeStub;
      if (id === 'react/jsx-runtime') {
        return { Fragment: 'Fragment', jsx: jsxStub, jsxs: jsxStub };
      }
      throw new Error(`产物请求了平台种子之外的模块：${id}`);
    });
    expect(exported.inject).toEqual(['slots', 'locale', 'configForms', 'remote', 'remote.session']);

    if (exported === undefined) throw new Error('产物工厂没有返回导出对象');
    const ctx = makeClientCtx();
    (exported.apply as (target: unknown) => void)(ctx);
    expect(ctx._slotInjections).toEqual([
      'shell.overlay',
      'plugins.row.config',
      'plugins.row.config',
    ]);
    expect(ctx._slotRegistrations[0]?.options.id).toBe('lark-bridge-auth');
    expect(ctx._slotRegistrations[1]?.options.key).toBe(
      'dsh-plugin-lark-bridge#dsh-plugin-lark-bridge',
    );
  });
});

describe('内联样式', () => {
  it('只带 utilities 与插件样式，不带 Tailwind preflight', () => {
    assertFreshDist();
    const css = inlinedCss();
    // preflight 会重置宿主页面的 html、body、标题与列表，必须挡在产物外。
    expect(css).not.toContain('html,:host{-webkit-text-size-adjust');
    expect(css).not.toContain(
      '*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}',
    );
  });

  it('把 shadcn 语义色映射到宿主令牌，并只作用于插件子树', () => {
    assertFreshDist();
    const css = inlinedCss();
    expect(css).toContain('--dsw-alias-bg-layer-2');
    expect(css).toContain('.bg-popover');
    expect(css).toContain('data-dsh-lark-ui');
  });

  it('内联 tooltip 的前景反转色与高 z-index 样式', () => {
    assertFreshDist();
    const css = inlinedCss();
    expect(css).toContain('.bg-foreground');
    expect(css).toContain('.text-background');
    expect(css).toContain('z-\\[1100\\]');
  });
});
