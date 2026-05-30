/**
 * live-refresh-scheduler — Definitional freshness LF3/LF4 — workflow delete/definition-edit + chained cascade.
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import type { LiveWorkflow, Request, WorkflowRunCache, WorkflowStep } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';
import * as H from './_harness';

const {
  makeWorkflow,
  makeVariable,
  makeRequest,
  flushAsync,
  storeState,
  activeSwitchState,
  clearWorkflowRunCacheMock,
  clearWorkflowRunCacheForEnvironmentMock,
  markWorkflowDefinitionallyStaleMock,
  markRunDefinitionallyStaleMock,
} = H;

// ── Workflow delete + definition-edit (LF3) ───────────────────────

describe('workflow delete + definition-edit (LF3)', () => {
  function fireWorkflowChange(): void {
    for (const fn of storeState.listeners.workflow) fn();
  }

  /** A workflow step with a single whole-body capture. */
  function step(uid: string, id: string, requestUid: string): WorkflowStep {
    return { uid, id, requestUid, captures: [{ uid: 'cap00001', name: 'v', extractor: { kind: 'whole-body' } }] };
  }

  /** Start the scheduler with the given workflows + fire one workflow-
   *  store event so the definition baseline is primed (hydration). */
  async function startPrimed(uids: string[]): Promise<void> {
    storeState.workflows = uids.map((uid) => makeWorkflow({ uid }));
    H.scheduler.startLiveScheduler();
    fireWorkflowChange();
    await flushAsync();
    clearWorkflowRunCacheMock.mockClear();
  }

  /** Start the scheduler with one runnable workflow whose definition the
   *  caller then mutates. The step's request is hydrated so the
   *  `canScheduleWorkflow` deleted-request guard passes. */
  async function startPrimedRunnable(workflow: LiveWorkflow): Promise<void> {
    storeState.requests.set('reqfetch1', makeRequest());
    storeState.requests.set('reqother1', makeRequest({ uid: 'reqother1' }));
    storeState.workflows = [workflow];
    storeState.variables = [makeVariable({ workflowUid: workflow.uid })];
    H.scheduler.startLiveScheduler();
    fireWorkflowChange();
    await flushAsync();
    clearWorkflowRunCacheMock.mockClear();
    markWorkflowDefinitionallyStaleMock.mockClear();
  }

  it('purges the cache rows of a deleted workflow', async () => {
    await startPrimed(['wflowAAA', 'wflowBBB']);

    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA' })];
    fireWorkflowChange();
    await flushAsync();

    expect(clearWorkflowRunCacheMock).toHaveBeenCalledTimes(1);
    expect(clearWorkflowRunCacheMock).toHaveBeenCalledWith('wflowBBB', 'ws-live');
  });

  it('does not purge on the first (priming) workflow-store event', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA' })];
    H.scheduler.startLiveScheduler();
    fireWorkflowChange();
    await flushAsync();

    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
  });

  it('does not purge when a workflow is added', async () => {
    await startPrimed(['wflowAAA']);

    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA' }), makeWorkflow({ uid: 'wflowBBB' })];
    fireWorkflowChange();
    await flushAsync();

    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
  });

  it('purges every deleted workflow when several vanish at once', async () => {
    await startPrimed(['wflowAAA', 'wflowBBB', 'wflowCCC']);

    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA' })];
    fireWorkflowChange();
    await flushAsync();

    const purged = clearWorkflowRunCacheMock.mock.calls.map((c) => c[0]).sort();
    expect(purged).toEqual(['wflowBBB', 'wflowCCC']);
  });

  it('flags + refreshes the active env when a step extractor changes', async () => {
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimedRunnable(makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqfetch1')] }));

    const editedStep: WorkflowStep = {
      uid: 'stp00001',
      id: 'fetch',
      requestUid: 'reqfetch1',
      captures: [{ uid: 'cap00001', name: 'v', extractor: { kind: 'json-path', path: '$.token' } }],
    };
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [editedStep] })];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
  });

  it('detects a step re-pointed at a different request', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimedRunnable(makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqfetch1')] }));

    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqother1')] })];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('detects a step added to the workflow', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimedRunnable(makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqfetch1')] }));

    storeState.workflows = [
      makeWorkflow({
        uid: 'wflowAAA',
        steps: [step('stp00001', 'fetch', 'reqfetch1'), step('stp00002', 'second', 'reqother1')],
      }),
    ];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
  });

  it('ignores a cosmetic edit (rename) — definition fingerprint unchanged', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimedRunnable(makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqfetch1')] }));

    storeState.workflows = [
      makeWorkflow({
        uid: 'wflowAAA',
        name: 'Renamed',
        description: 'docs',
        steps: [step('stp00001', 'fetch', 'reqfetch1')],
      }),
    ];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('ignores a scheduling-axis edit (enabled / refresh cadence)', async () => {
    await startPrimedRunnable(makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqfetch1')] }));

    storeState.workflows = [
      makeWorkflow({
        uid: 'wflowAAA',
        enabled: false,
        refresh: { kind: 'interval', seconds: 600 },
        steps: [step('stp00001', 'fetch', 'reqfetch1')],
      }),
    ];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).not.toHaveBeenCalled();
  });

  it('flags a manual-trigger workflow definitionally stale instead of auto-running it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimedRunnable(
      makeWorkflow({ uid: 'wflowAAA', refresh: { kind: 'manual' }, steps: [step('stp00001', 'fetch', 'reqfetch1')] }),
    );

    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', refresh: { kind: 'manual' }, steps: [step('stp00001', 'fetch', 'reqother1')] }),
    ];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('flags a disabled non-manual workflow without refreshing it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimedRunnable(
      makeWorkflow({ uid: 'wflowAAA', enabled: false, steps: [step('stp00001', 'fetch', 'reqfetch1')] }),
    );

    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', enabled: false, steps: [step('stp00001', 'fetch', 'reqother1')] }),
    ];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

// ── Chained-workflow cascade (LF4) ────────────────────────────────

describe('chained-workflow cascade (LF4)', () => {
  type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };

  /** A request whose Authorization header carries `refValue`. */
  function requestRef(uid: string, refValue: string): Request {
    return makeRequest({ uid, headers: [{ uid: 'hdrauth01', key: 'Authorization', value: refValue, enabled: true }] });
  }

  function step(uid: string, requestUid: string) {
    return { uid, id: 'fetch', requestUid, captures: [] };
  }

  /**
   * Workspace cache mirror. Every `onLiveCacheStoreChange` broadcast
   * carries the FULL post-write run list for the workspace (see
   * `notifyChange` in `live-cache-store`) — this table reproduces that
   * contract so the LF4 `extractedAt` baseline tracks every workflow.
   */
  function makeCacheTable() {
    const rows = new Map<string, WorkflowRunCache>();
    const key = (uid: string, env: string | null) => `${uid}::${env ?? '__none__'}`;
    const set = (uid: string, env: string | null, extractedAt: number): void => {
      rows.set(key(uid, env), {
        workflowUid: uid,
        environmentId: env,
        stepCaptures: {},
        stepResponseBytes: {},
        extractedAt,
        expiresAt: null,
        consecutiveFailures: 0,
        lastExtractorOk: true,
      } as WorkflowRunCache);
    };
    const fire = (changedUid: string): void => {
      const snapshot = [...rows.values()];
      for (const fn of storeState.listeners.cache) fn('ws-live', changedUid, snapshot);
    };
    return {
      /** Seed several rows, then fire one (priming) broadcast carrying all of them. */
      prime(entries: Array<[string, string | null, number]>): void {
        for (const [uid, env, extractedAt] of entries) set(uid, env, extractedAt);
        fire(entries[0]?.[0] ?? 'wflowAAA');
      },
      /** Set a row's `extractedAt`, then fire the broadcast for `changedUid`. */
      bumpAndFire(changedUid: string, env: string | null, extractedAt: number): void {
        set(changedUid, env, extractedAt);
        fire(changedUid);
      },
    };
  }

  it('cascade-refreshes a downstream workflow when its upstream live value is refreshed', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1); // priming broadcast
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2); // a real refresh
    await flushAsync();

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ workflow: { uid: 'wflowBBB' }, environmentId: 'env-dev' });
  });

  it('flags a non-active env row of a downstream workflow definitionally stale (never drops it)', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-prod';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();

    // The downstream env is not the active env — the row is flagged
    // (kept + scheduled, re-warms via the due-now reconcile alarm), not
    // dropped. Dropping would strip it from `collectEntries`.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflowBBB', 'env-dev', 'ws-live');
  });

  it('flags a downstream workflow that is not schedulable right now (disabled)', async () => {
    // Finding-A shape: a non-manual downstream that can't run at the
    // instant of the cascade (here, disabled) must still be flagged
    // definitionally stale so it re-warms once it becomes schedulable —
    // the flag precedes the `canScheduleWorkflow` gate.
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', enabled: false, steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflowBBB', 'env-dev', 'ws-live');
  });

  it('flags a manual downstream workflow definitionally stale instead of refreshing', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', refresh: { kind: 'manual' }, steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflowBBB', 'env-dev', 'ws-live');
  });

  it('does not cascade when extractedAt did not advance (a failed refresh)', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 5);
    await flushAsync();

    // A's row rewritten (e.g. recordRefreshError) — extractedAt unchanged.
    cache.bumpAndFire('wflowAAA', 'env-dev', 5);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
  });

  it('does not cascade on the first (priming) cache event', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' })];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();

    // The very first broadcast — even with a high extractedAt — only primes.
    cache.bumpAndFire('wflowAAA', 'env-dev', 99);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('does not cascade to a workflow that does not consume the upstream live value', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    // B's request embeds no `{{live.X}}` reference — no downstream edge.
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', makeRequest({ uid: 'reqB00001' }));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' })];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('walks a chain hop-by-hop — refreshing B then cascading to C', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    // A → B → C: B embeds {{live.authToken}} (A's LV); C embeds {{live.bToken}} (B's LV).
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.requests.set('reqC00001', requestRef('reqC00001', '{{live.bToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
      makeWorkflow({ uid: 'wflowCCC', steps: [step('stpC0001', 'reqC00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
      makeVariable({ uid: 'lvccc001', name: 'cToken', workflowUid: 'wflowCCC' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    // A refreshes → cascade refreshes B.
    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();
    expect(refreshSpy.mock.calls.map((c) => c[0].workflow.uid)).toEqual(['wflowBBB']);

    // The stub adapter doesn't write the cache; emulate B's refresh
    // landing — its cache row advances, which is the next hop to C.
    cache.bumpAndFire('wflowBBB', 'env-dev', 3);
    await flushAsync();
    expect(refreshSpy.mock.calls.map((c) => c[0].workflow.uid)).toEqual(['wflowBBB', 'wflowCCC']);
  });

  it('skips a dependency cycle without looping', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    // A ↔ B cycle: A embeds {{live.bToken}}, B embeds {{live.authToken}}.
    storeState.requests.set('reqA00001', requestRef('reqA00001', '{{live.bToken}}'));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();

    // The A→B edge closes a cycle (B reaches A) — refused, no refresh.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
  });

  it('coalesces — a downstream of two refreshed upstreams refreshes once', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    // A1 + A2 both upstream of B (B embeds both LVs).
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqA00002', makeRequest({ uid: 'reqA00002' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.tokenOne}}{{live.tokenTwo}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAA1', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowAA2', steps: [step('stpA0002', 'reqA00002')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvone001', name: 'tokenOne', workflowUid: 'wflowAA1' }),
      makeVariable({ uid: 'lvtwo001', name: 'tokenTwo', workflowUid: 'wflowAA2' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.prime([
      ['wflowAA1', 'env-dev', 1],
      ['wflowAA2', 'env-dev', 1],
    ]);
    await flushAsync();

    // Both upstreams refresh inside one debounce window — the two
    // synchronous events re-arm the same timer before it fires.
    cache.bumpAndFire('wflowAA1', 'env-dev', 2);
    cache.bumpAndFire('wflowAA2', 'env-dev', 2);
    await flushAsync();

    expect(refreshSpy.mock.calls.map((c) => c[0].workflow.uid)).toEqual(['wflowBBB']);
  });
});
