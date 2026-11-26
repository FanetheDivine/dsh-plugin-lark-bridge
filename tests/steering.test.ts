import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { workspaceRelative } from '../src/lark-super-agent/paths.ts';
import { type SteeringAgent, settleSteering } from '../src/steering.ts';

function makeAgent(status: string, pending: string[]) {
  const nextStep = pending.map((id) => ({ id }));
  const remove = vi.fn((id: string) => {
    const index = nextStep.findIndex((item) => item.id === id);
    if (index >= 0) nextStep.splice(index, 1);
  });
  const followup = vi.fn();
  const agent: SteeringAgent = { status, inbox: { nextStep, remove }, followup };
  return { agent, remove, followup };
}

describe('settleSteering', () => {
  it('moves a stranded message to a followup when the session is idle', async () => {
    const { agent, remove, followup } = makeAgent('idle', ['m1']);
    const warn = vi.fn();
    await settleSteering(agent, { id: 'm1' }, { warn });
    expect(remove).toHaveBeenCalledWith('m1');
    expect(followup).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('delivering m1 as a followup'));
  });

  it('leaves the message alone while the session is running', async () => {
    const { agent, remove, followup } = makeAgent('running', ['m1']);
    await settleSteering(agent, { id: 'm1' }, { warn: vi.fn() });
    expect(remove).not.toHaveBeenCalled();
    expect(followup).not.toHaveBeenCalled();
  });

  it('leaves the message alone when it was already consumed', async () => {
    const { agent, followup } = makeAgent('idle', []);
    await settleSteering(agent, { id: 'm1' }, { warn: vi.fn() });
    expect(followup).not.toHaveBeenCalled();
  });
});

describe('workspaceRelative', () => {
  it('returns a slash-separated path relative to the workspace root', () => {
    const root = join('work', 'dispatch');
    const path = join(root, 'reports', 'task-1', 'report-1.md');
    expect(workspaceRelative(root, path)).toBe('reports/task-1/report-1.md');
  });

  it('keeps a path outside the root without turning it into a relative one', () => {
    const outside = workspaceRelative(join('work', 'dispatch'), join('other', 'a.md'));
    expect(outside.startsWith('..')).toBe(false);
    expect(outside.includes('\\')).toBe(false);
    expect(outside.endsWith('other/a.md')).toBe(true);
  });
});
