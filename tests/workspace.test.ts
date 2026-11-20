// 工作区选择测试：注册解析、删除失效、重置与异步乱序。
import type { Workspace, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceSelection } from '../src/workspace.ts';
import { toHostWorkspacePath } from '../src/workspace-path.ts';

/** 构造测试工作区。 */
function workspace(id: string, root = '/c/work/demo'): Workspace {
  return { id, path: toHostWorkspacePath(root), title: id } as Workspace;
}

/** 构造只含路径解析能力的注册表。 */
function registry(
  resolveByPath: (path: string) => Promise<Workspace | undefined>,
): WorkspaceRegistry {
  return { resolveByPath: vi.fn(resolveByPath) } as unknown as WorkspaceRegistry;
}

/** 可控异步结果。 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('WorkspaceSelection.resolve', () => {
  it('空选择不访问注册表', async () => {
    const resolveByPath = vi.fn(async () => workspace('ws_1'));
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => '',
      getRegistry: () => registry(resolveByPath),
    });

    expect(await selection.resolve()).toEqual({ root: '', workspace: undefined, current: true });
    expect(resolveByPath).not.toHaveBeenCalled();
    expect(selection.valid).toBe(false);
    expect(selection.currentId).toBeUndefined();
  });

  it('用 Host 原生路径解析并缓存有效工作区', async () => {
    const selected = workspace('ws_1');
    const resolveByPath = vi.fn(async () => selected);
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () => registry(resolveByPath),
    });

    expect(await selection.resolve()).toEqual({
      root: '/c/work/demo',
      workspace: selected,
      current: true,
    });
    expect(resolveByPath).toHaveBeenCalledWith(toHostWorkspacePath('/c/work/demo'));
    expect(selection.valid).toBe(true);
    expect(selection.currentId).toBe('ws_1');
  });

  it('目录存在但未注册时返回无效选择', async () => {
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () => registry(async () => undefined),
    });

    expect(await selection.resolve()).toEqual({
      root: '/c/work/demo',
      workspace: undefined,
      current: true,
    });
    expect(selection.valid).toBe(false);
    expect(selection.currentId).toBeUndefined();
  });

  it('注册表不可用或解析异常时返回无效选择', async () => {
    const missing = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () => undefined,
    });
    const failing = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () =>
        registry(async () => {
          throw new Error('registry failed');
        }),
    });

    expect((await missing.resolve()).workspace).toBeUndefined();
    expect((await failing.resolve()).workspace).toBeUndefined();
    expect(missing.valid).toBe(false);
    expect(failing.valid).toBe(false);
  });

  it('旧解析结果不覆盖新工作区缓存', async () => {
    let root = '/c/work/demo/old';
    const oldResult = deferred<Workspace | undefined>();
    const newResult = deferred<Workspace | undefined>();
    const oldWorkspace = workspace('ws_old', root);
    const newWorkspace = workspace('ws_new', '/c/work/demo/new');
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => root,
      getRegistry: () =>
        registry((path) =>
          path === toHostWorkspacePath('/c/work/demo/old') ? oldResult.promise : newResult.promise,
        ),
    });

    const oldResolve = selection.resolve();
    root = '/c/work/demo/new';
    const newResolve = selection.resolve();
    newResult.resolve(newWorkspace);
    expect(await newResolve).toEqual({
      root: '/c/work/demo/new',
      workspace: newWorkspace,
      current: true,
    });
    oldResult.resolve(oldWorkspace);
    expect(await oldResolve).toEqual({
      root: '/c/work/demo/old',
      workspace: oldWorkspace,
      current: false,
    });
    expect(selection.valid).toBe(true);
    expect(selection.currentId).toBe('ws_new');
  });
});

describe('WorkspaceSelection.invalidate', () => {
  it('目标工作区删除时立即失效', async () => {
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () => registry(async () => workspace('ws_1')),
    });
    await selection.resolve();

    expect(
      selection.invalidate({
        domain: 'workspace',
        table: 'workspaces',
        operation: 'deleted',
        key: 'ws_1',
      }),
    ).toBe(true);
    expect(selection.valid).toBe(false);
    expect(selection.currentId).toBeUndefined();
  });

  it('无关删除与其他变更保持当前选择', async () => {
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () => registry(async () => workspace('ws_1')),
    });
    await selection.resolve();

    expect(
      selection.invalidate({
        domain: 'workspace',
        table: 'workspaces',
        operation: 'deleted',
        key: 'ws_2',
      }),
    ).toBe(false);
    expect(
      selection.invalidate({
        domain: 'workspace',
        table: 'workspaces',
        operation: 'updated',
        key: 'ws_1',
      }),
    ).toBe(false);
    expect(
      selection.invalidate({
        domain: 'other',
        table: 'workspaces',
        operation: 'deleted',
        key: 'ws_1',
      }),
    ).toBe(false);
    expect(selection.valid).toBe(true);
    expect(selection.currentId).toBe('ws_1');
  });
});

describe('WorkspaceSelection.reset', () => {
  it('清除有效性与当前工作区 id', async () => {
    const selection = new WorkspaceSelection({
      getWorkspaceRoot: () => '/c/work/demo',
      getRegistry: () => registry(async () => workspace('ws_1')),
    });
    await selection.resolve();

    selection.reset();

    expect(selection.valid).toBe(false);
    expect(selection.currentId).toBeUndefined();
  });
});
