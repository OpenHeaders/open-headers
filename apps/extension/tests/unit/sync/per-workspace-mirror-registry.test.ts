/**
 * Per-workspace mirror registry — generic helper used by every
 * `*-sync-mirror.ts` adapter to host a `Map<workspaceId, XSyncMirror>`
 * with lazy creation. This is the structural fix for the v1.1 runtime
 * bug ("env created in tab2/w2 in only-this-tab mode lands in
 * wsKeys(w1).environments"): every mirror lookup goes through the
 * registry's `workspaceId` key.
 *
 * We verify the registry contract directly:
 *   - getOrCreate calls the factory exactly once per workspaceId
 *   - peek never creates
 *   - dispose tears one entry down and removes it from the map
 *   - dispose is idempotent (no factory re-fire on the next getOrCreate)
 *   - disposeAll tears every entry down
 *   - residentWorkspaceIds reflects current keys
 */

import { describe, expect, it, vi } from 'vitest';

import { createWorkspaceMirrorRegistry } from '@openheaders/ui/context';

interface FakeMirror {
  workspaceId: string;
  dispose: () => void;
}

function makeFactory() {
  const disposeSpies = new Map<string, ReturnType<typeof vi.fn>>();
  const factory = vi.fn((workspaceId: string): FakeMirror => {
    const dispose = vi.fn();
    disposeSpies.set(workspaceId, dispose);
    return { workspaceId, dispose };
  });
  return { factory, disposeSpies };
}

describe('createWorkspaceMirrorRegistry', () => {
  it('lazily creates a mirror on first getOrCreate, then returns the same instance on subsequent calls', () => {
    const { factory } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    const m1 = reg.getOrCreate('ws-1');
    const m2 = reg.getOrCreate('ws-1');
    expect(m1).toBe(m2);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('ws-1');
  });

  it('mints a fresh mirror per distinct workspaceId', () => {
    const { factory } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    const a = reg.getOrCreate('ws-A');
    const b = reg.getOrCreate('ws-B');
    expect(a).not.toBe(b);
    expect(a.workspaceId).toBe('ws-A');
    expect(b.workspaceId).toBe('ws-B');
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('peek never creates — returns null when the workspaceId is absent', () => {
    const { factory } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    expect(reg.peek('ws-1')).toBeNull();
    expect(factory).not.toHaveBeenCalled();
    reg.getOrCreate('ws-1');
    expect(reg.peek('ws-1')?.workspaceId).toBe('ws-1');
    expect(reg.peek('ws-other')).toBeNull();
  });

  it('dispose tears one entry down, calls its dispose method, and removes it from the map', () => {
    const { factory, disposeSpies } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    reg.getOrCreate('ws-1');
    reg.dispose('ws-1');
    expect(disposeSpies.get('ws-1')).toHaveBeenCalledTimes(1);
    expect(reg.peek('ws-1')).toBeNull();
  });

  it('dispose on an absent workspaceId is a no-op', () => {
    const { factory } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    // No throw, no factory call, no resident entry.
    expect(() => reg.dispose('never-created')).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it('a re-getOrCreate after dispose mints a FRESH mirror (the disposed one is not resurrected)', () => {
    const { factory } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    const first = reg.getOrCreate('ws-1');
    const firstDispose = first.dispose as ReturnType<typeof vi.fn>;
    reg.dispose('ws-1');
    const second = reg.getOrCreate('ws-1');
    expect(second).not.toBe(first);
    expect(factory).toHaveBeenCalledTimes(2);
    // The first mirror's dispose was called once; the second mirror's
    // dispose has not been called.
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(second.dispose as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('disposeAll tears down every resident entry', () => {
    const { factory, disposeSpies } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    reg.getOrCreate('ws-A');
    reg.getOrCreate('ws-B');
    reg.disposeAll();
    expect(disposeSpies.get('ws-A')).toHaveBeenCalledTimes(1);
    expect(disposeSpies.get('ws-B')).toHaveBeenCalledTimes(1);
    expect(reg.residentWorkspaceIds()).toEqual([]);
  });

  it('residentWorkspaceIds reflects the current key set', () => {
    const { factory } = makeFactory();
    const reg = createWorkspaceMirrorRegistry<FakeMirror>(factory);
    expect(reg.residentWorkspaceIds()).toEqual([]);
    reg.getOrCreate('ws-A');
    reg.getOrCreate('ws-B');
    expect(reg.residentWorkspaceIds().sort()).toEqual(['ws-A', 'ws-B']);
    reg.dispose('ws-A');
    expect(reg.residentWorkspaceIds()).toEqual(['ws-B']);
  });
});
