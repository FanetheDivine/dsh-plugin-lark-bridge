/** 当前工作区选择：注册解析、有效性缓存与删除失效。 */
import type { Workspace, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';

import {
  normalizeWorkspacePath,
  sameWorkspacePath,
  toHostWorkspacePath,
} from './workspace-path.ts';

/** WorkspaceSelection 的依赖。 */
export interface WorkspaceSelectionDeps {
  readonly getWorkspaceRoot: () => string;
  readonly getRegistry: () => WorkspaceRegistry | undefined;
}

/** 一次注册解析的结果；current=false 表示结果已过期。 */
export interface WorkspaceResolution {
  readonly root: string;
  readonly workspace: Workspace | undefined;
  readonly current: boolean;
}

/** 保存最近一次有效解析，并用序号阻止旧结果覆盖新选择。 */
export class WorkspaceSelection {
  private readonly deps: WorkspaceSelectionDeps;
  private revision = 0;
  private selectedRoot = '';
  private selectedWorkspace: Workspace | undefined;

  constructor(deps: WorkspaceSelectionDeps) {
    this.deps = deps;
  }

  /** 当前配置是否与已解析的注册工作区一致。 */
  get valid(): boolean {
    return (
      this.selectedWorkspace !== undefined &&
      sameWorkspacePath(this.selectedRoot, this.deps.getWorkspaceRoot())
    );
  }

  /** 当前注册工作区 id。 */
  get currentId(): string | undefined {
    return this.valid && this.selectedWorkspace !== undefined
      ? String(this.selectedWorkspace.id)
      : undefined;
  }

  /** 使当前缓存和未完成的解析失效。 */
  reset(): void {
    this.revision += 1;
    this.selectedRoot = '';
    this.selectedWorkspace = undefined;
  }

  /** 目标注册项删除时同步失效。 */
  invalidate(change: unknown): boolean {
    if (typeof change !== 'object' || change === null) return false;
    const record = change as Record<string, unknown>;
    if (
      record['domain'] !== 'workspace' ||
      record['table'] !== 'workspaces' ||
      record['operation'] !== 'deleted' ||
      record['key'] !== this.currentId
    ) {
      return false;
    }
    this.reset();
    return true;
  }

  /** 解析当前配置；只有最新结果可以更新缓存。 */
  async resolve(): Promise<WorkspaceResolution> {
    const revision = ++this.revision;
    const root = normalizeWorkspacePath(this.deps.getWorkspaceRoot());
    let workspace: Workspace | undefined;
    if (root !== '') {
      const registry = this.deps.getRegistry();
      try {
        workspace = await registry?.resolveByPath(toHostWorkspacePath(root));
      } catch {
        workspace = undefined;
      }
    }
    const current =
      revision === this.revision && sameWorkspacePath(root, this.deps.getWorkspaceRoot());
    if (current) {
      this.selectedRoot = root;
      this.selectedWorkspace = workspace;
    }
    return { root, workspace, current };
  }
}
