/**
 * Per-scope catch-up driver — FSM + repeatability coverage (U6.3 Part B).
 *
 * The driver is reusable: `start(scope)` runs once per sync scope —
 * `__global__`, then each consumed workspace (U6.4 fan-out). These
 * tests pin the per-scope frame routing + the resume-from-terminal
 * contract the fan-out relies on.
 */
import {
  SNAPSHOT_SCHEMA_VERSION,
  SYNC_SNAPSHOT_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';

import { createScopeCatchupDriver } from '../../../src/sync/client/scope-catchup-driver';

function emptySnapshot(workspaceId: string): WorkspaceSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId,
    takenAtHlc: {},
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    grpcRequests: [],
    websocketRequests: [],
    responseExamples: [],
    grpcResponseExamples: [],
    wsResponseExamples: [],
    scriptPackages: [],
    specs: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createScopeCatchupDriver>[0]> = {}) {
  const send = vi.fn<(frame: object) => boolean>(() => true);
  const applySnapshot = vi.fn<(snapshot: WorkspaceSnapshot) => Promise<void>>(async () => {});
  const onSynced = vi.fn<(scope: string, peerVector: unknown) => Promise<void>>(async () => {});
  const deps = { send, readStateVector: async () => ({}), applySnapshot, onSynced, ...overrides };
  return { deps, send, applySnapshot, onSynced };
}

describe('createScopeCatchupDriver', () => {
  it('start(scope) sends a STATE_VECTOR stamped with the scope', async () => {
    const { deps, send } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    await driver.start('__global__');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ type: SYNC_STATE_VECTOR_TYPE, workspaceId: '__global__' });
    expect(driver.state()).toBe('vector-sent');
    expect(driver.currentScope()).toBe('__global__');
  });

  it('SNAPSHOT → catching-up → SYNCED → synced for the matching scope', async () => {
    const { deps, applySnapshot, onSynced } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    await driver.start('ws-7');
    await driver.handle({ type: SYNC_SNAPSHOT_TYPE, workspaceId: 'ws-7', snapshot: emptySnapshot('ws-7') });
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(driver.state()).toBe('catching-up');
    await driver.handle({ type: SYNC_SYNCED_TYPE, workspaceId: 'ws-7', stateVectorAfter: {} });
    expect(onSynced).toHaveBeenCalledWith('ws-7', {});
    expect(driver.state()).toBe('synced');
  });

  it('drops frames whose scope does not match the running catch-up', async () => {
    const { deps, applySnapshot, onSynced } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    await driver.start('ws-7');
    await driver.handle({ type: SYNC_SNAPSHOT_TYPE, workspaceId: 'ws-other', snapshot: emptySnapshot('ws-other') });
    await driver.handle({ type: SYNC_SYNCED_TYPE, workspaceId: 'ws-other', stateVectorAfter: {} });
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(onSynced).not.toHaveBeenCalled();
    expect(driver.state()).toBe('vector-sent');
  });

  it('is repeatable — start(nextScope) runs a fresh catch-up after the prior one synced (U6.4)', async () => {
    const { deps, send, onSynced } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    await driver.start('__global__');
    await driver.handle({ type: SYNC_SYNCED_TYPE, workspaceId: '__global__', stateVectorAfter: {} });
    expect(driver.state()).toBe('synced');

    await driver.start('ws-7');
    expect(driver.currentScope()).toBe('ws-7');
    expect(driver.state()).toBe('vector-sent');
    expect(send.mock.calls[1][0]).toMatchObject({ type: SYNC_STATE_VECTOR_TYPE, workspaceId: 'ws-7' });
    await driver.handle({ type: SYNC_SYNCED_TYPE, workspaceId: 'ws-7', stateVectorAfter: {} });
    expect(onSynced).toHaveBeenNthCalledWith(2, 'ws-7', {});
  });

  it('ignores start(scope) while a catch-up is still running', async () => {
    const { deps, send } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    await driver.start('__global__');
    await driver.start('ws-7'); // still in vector-sent — ignored
    expect(driver.currentScope()).toBe('__global__');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('transitions to failed when readStateVector throws', async () => {
    const { deps } = makeDeps({
      readStateVector: async () => {
        throw new Error('log unreachable');
      },
    });
    const driver = createScopeCatchupDriver(deps);
    await driver.start('__global__');
    expect(driver.state()).toBe('failed');
    expect(driver.failureDetail()).toMatch(/log unreachable/);
  });

  it('transitions to failed when applySnapshot throws', async () => {
    const { deps } = makeDeps({
      applySnapshot: vi.fn(async () => {
        throw new Error('apply boom');
      }),
    });
    const driver = createScopeCatchupDriver(deps);
    await driver.start('ws-7');
    await driver.handle({ type: SYNC_SNAPSHOT_TYPE, workspaceId: 'ws-7', snapshot: emptySnapshot('ws-7') });
    expect(driver.state()).toBe('failed');
    expect(driver.failureDetail()).toMatch(/apply boom/);
  });

  it('times out when SYNCED never arrives', async () => {
    let fired: (() => void) | null = null;
    const setTimer = vi.fn((fn: () => void) => {
      fired = fn;
      return 1 as unknown;
    });
    const { deps } = makeDeps({ setTimer, clearTimer: vi.fn(), timeoutMs: 50 });
    const driver = createScopeCatchupDriver(deps);
    await driver.start('__global__');
    fired!();
    expect(driver.state()).toBe('timed-out');
  });

  it('disarms the catch-up timer when SYNCED arrives, before the onSynced flush', async () => {
    // Cross-phase audit (U6): SYNCED is the terminal wire frame — the
    // phase is done. A slow `onSynced` pending-out flush must not leave
    // the timer armed, or it trips a spurious `timed-out` mid-flush that
    // corrupts the next fanned-out scope's run.
    const clearTimer = vi.fn();
    let releaseFlush: (() => void) | null = null;
    const onSynced = vi.fn(
      async () =>
        await new Promise<void>((resolve) => {
          releaseFlush = resolve;
        }),
    );
    const { deps } = makeDeps({ setTimer: vi.fn(() => 1 as unknown), clearTimer, onSynced });
    const driver = createScopeCatchupDriver(deps);
    await driver.start('ws-7');
    await driver.handle({ type: SYNC_SNAPSHOT_TYPE, workspaceId: 'ws-7', snapshot: emptySnapshot('ws-7') });
    expect(driver.state()).toBe('catching-up');
    // SYNCED received — handleSynced clears the timer, then awaits the
    // (still-pending) flush.
    const handled = driver.handle({ type: SYNC_SYNCED_TYPE, workspaceId: 'ws-7', stateVectorAfter: {} });
    expect(clearTimer).toHaveBeenCalled();
    expect(driver.state()).toBe('catching-up'); // mid-flush, not timed-out
    releaseFlush!();
    await handled;
    expect(driver.state()).toBe('synced');
  });

  it('handles() claims SNAPSHOT / SYNCED / STATE_VECTOR only', () => {
    const { deps } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    for (const t of [SYNC_SNAPSHOT_TYPE, SYNC_SYNCED_TYPE, SYNC_STATE_VECTOR_TYPE]) {
      expect(driver.handles({ type: t })).toBe(true);
    }
    expect(driver.handles({ type: 'oh.sync.welcome' })).toBe(false);
    expect(driver.handles({ type: 'oh.sync.mutation' })).toBe(false);
    expect(driver.handles(null)).toBe(false);
  });

  it('reset() clears the scope back to idle', async () => {
    const { deps } = makeDeps();
    const driver = createScopeCatchupDriver(deps);
    await driver.start('__global__');
    driver.reset();
    expect(driver.state()).toBe('idle');
    expect(driver.currentScope()).toBeNull();
  });
});
