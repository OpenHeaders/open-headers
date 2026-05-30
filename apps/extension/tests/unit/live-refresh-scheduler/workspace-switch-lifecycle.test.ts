/**
 * live-refresh-scheduler — Cross-workspace switch recovery, active-workspace-only, sleep/wake, and kick-context catch-up.
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import type { Environment, LiveWorkflow, Request, WorkflowRunCache, WorkflowStep } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';
import * as H from './_harness';

const {
  makeWorkflow,
  makeVariable,
  makeRequest,
  flushAsync,
  NOW,
  storeState,
  activeSwitchState,
  seedStorageMany,
  alarmsCreateMock,
  alarmsClearMock,
  alarmsGetAllMock,
  markWorkflowDefinitionallyStaleMock,
  markRunDefinitionallyStaleMock,
} = H;

// ── Cross-workspace switch recovery (LF1 / LF2 / LF4) ──────────────
//
// The three debounced detectors hold per-workspace baselines + pending
// queues so a detection landing just before a workspace switch is not
// lost. LF1/LF2 re-diff against the originating workspace's preserved
// baseline once it is active again; LF4's per-workspace cascade bucket
// is drained by the `onActiveWorkspaceChange` hook. (LF3 has no
// debounce, so it is structurally immune and not exercised here.)

describe('cross-workspace switch recovery (LF1/LF2/LF4)', () => {
  function wfStep(uid: string, requestUid: string): WorkflowStep {
    return {
      uid,
      id: 'fetch',
      requestUid,
      captures: [{ uid: 'cap00001', name: 'v', extractor: { kind: 'whole-body' } }],
    };
  }
  function requestRef(uid: string, refValue: string): Request {
    return makeRequest({ uid, headers: [{ uid: 'hdrauth01', key: 'Authorization', value: refValue, enabled: true }] });
  }
  function makeEnvironment(uid: string, vars: Array<{ name: string; value: string }>): Environment {
    return {
      schemaVersion: 5,
      uid,
      name: uid,
      variables: vars.map((v, i) => ({ uid: `${uid}var${i}`, name: v.name, value: v.value, type: 'default' as const })),
    };
  }
  /** Point the harness at `wsId` and fire the broadcasts a real switch
   *  emits — the active-workspace listeners + the store re-hydration. */
  function switchWorkspace(wsId: string, prev: string): void {
    H.activeWorkspace.id = wsId;
    for (const fn of activeSwitchState.workspaceListeners) fn(wsId, prev);
    for (const fn of storeState.listeners.request) fn();
    for (const fn of storeState.listeners.environment) fn();
    for (const fn of storeState.listeners.workflow) fn();
  }

  it('recovers a request edit made while another workspace was active (LF1)', async () => {
    H.scheduler.__setRequestEditRefreshDebounceMs(0);
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: vi.fn(async () => {}) });

    // Workspace A — workflow WA embeds request RA.
    storeState.requests = new Map([['reqAAAA1', makeRequest({ uid: 'reqAAAA1' })]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA', 'reqAAAA1')] })];
    storeState.variables = [makeVariable({ uid: 'lvAAAA1', workflowUid: 'wflowAAA' })];
    H.scheduler.startLiveScheduler();
    for (const fn of storeState.listeners.request) fn(); // prime A's baseline
    await flushAsync();

    // Switch to workspace B — its own request + workflow.
    storeState.requests = new Map([['reqBBBB1', makeRequest({ uid: 'reqBBBB1' })]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowBBB', steps: [wfStep('stpB', 'reqBBBB1')] })];
    storeState.variables = [makeVariable({ uid: 'lvBBBB1', workflowUid: 'wflowBBB' })];
    switchWorkspace('ws-b', 'ws-live');
    await flushAsync();
    markWorkflowDefinitionallyStaleMock.mockClear();

    // Back to A — RA carries a material edit landed during the B excursion.
    storeState.requests = new Map([
      ['reqAAAA1', makeRequest({ uid: 'reqAAAA1', url: 'https://api.openheaders.io/token-v2' })],
    ]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA', 'reqAAAA1')] })];
    storeState.variables = [makeVariable({ uid: 'lvAAAA1', workflowUid: 'wflowAAA' })];
    switchWorkspace('ws-live', 'ws-b');
    await flushAsync();

    // A's pre-edit baseline survived the excursion — the edit is caught
    // (a global baseline would have been clobbered by the B snapshot).
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
  });

  it('recovers a variable edit made while another workspace was active (LF2)', async () => {
    H.scheduler.__setVariableEditRefreshDebounceMs(0);
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: vi.fn(async () => {}) });
    activeSwitchState.activeEnvId = 'env-a';

    // Workspace A — WA's request resolves `{{env.token}}` in env-a.
    storeState.requests = new Map([['reqAAAA1', requestRef('reqAAAA1', '{{env.token}}')]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA', 'reqAAAA1')] })];
    storeState.variables = [makeVariable({ uid: 'lvAAAA1', workflowUid: 'wflowAAA' })];
    storeState.environments = [makeEnvironment('env-a', [{ name: 'token', value: 'v1' }])];
    H.scheduler.startLiveScheduler();
    for (const fn of storeState.listeners.environment) fn(); // prime A's baseline
    await flushAsync();

    // Switch to workspace B.
    storeState.requests = new Map([['reqBBBB1', requestRef('reqBBBB1', '{{env.other}}')]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowBBB', steps: [wfStep('stpB', 'reqBBBB1')] })];
    storeState.variables = [makeVariable({ uid: 'lvBBBB1', workflowUid: 'wflowBBB' })];
    storeState.environments = [makeEnvironment('env-b', [{ name: 'other', value: 'x' }])];
    switchWorkspace('ws-b', 'ws-live');
    await flushAsync();
    markRunDefinitionallyStaleMock.mockClear();

    // Back to A — env-a's `token` was edited during the B excursion.
    storeState.requests = new Map([['reqAAAA1', requestRef('reqAAAA1', '{{env.token}}')]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA', 'reqAAAA1')] })];
    storeState.variables = [makeVariable({ uid: 'lvAAAA1', workflowUid: 'wflowAAA' })];
    storeState.environments = [makeEnvironment('env-a', [{ name: 'token', value: 'v2-CHANGED' }])];
    switchWorkspace('ws-live', 'ws-b');
    await flushAsync();

    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'env-a', 'ws-live');
  });

  it('recovers a cascade detected just before a switch away (LF4)', async () => {
    H.scheduler.__setLiveCascadeRefreshDebounceMs(0);
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: vi.fn(async () => {}) });
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [wfStep('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [
      makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' }),
      makeVariable({ uid: 'lvbbb001', name: 'bToken', workflowUid: 'wflowBBB' }),
    ];
    H.scheduler.startLiveScheduler();

    // Each broadcast carries the full post-write run list (the
    // `live-cache-store` contract) so the `extractedAt` baseline tracks.
    const fireCache = (extractedAt: number): void => {
      const runs = [
        {
          workflowUid: 'wflowAAA',
          environmentId: 'env-dev',
          stepCaptures: {},
          stepResponseBytes: {},
          extractedAt,
          expiresAt: null,
          consecutiveFailures: 0,
          lastExtractorOk: true,
        },
      ] as WorkflowRunCache[];
      for (const fn of storeState.listeners.cache) fn('ws-live', 'wflowAAA', runs);
    };
    fireCache(1); // priming broadcast
    await flushAsync();

    // Upstream A advances → a cascade is queued for ws-live → the user
    // switches away before the debounced settle drains the bucket.
    fireCache(2);
    H.activeWorkspace.id = 'ws-b';
    for (const fn of activeSwitchState.workspaceListeners) fn('ws-b', 'ws-live');
    await flushAsync();
    // The settle fired while ws-b was active — it found ws-b's bucket
    // empty and left ws-live's bucket intact, so nothing was flagged.
    expect(markRunDefinitionallyStaleMock).not.toHaveBeenCalled();

    // Switch back — the workspace-switch hook drains ws-live's bucket.
    H.activeWorkspace.id = 'ws-live';
    for (const fn of activeSwitchState.workspaceListeners) fn('ws-live', 'ws-b');
    await flushAsync();
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflowBBB', 'env-dev', 'ws-live');
  });
});

// ── Active-workspace-only contract ────────────────────────────────

describe('active-workspace-only', () => {
  it('reconcile only schedules workflows from the active workspace', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    // Even if storage carries other workspaces' metadata, the scheduler
    // ignores them — `getLiveWorkflows()` returns the active workspace's
    // in-memory snapshot only.
    seedStorageMany({
      'oh.workspaces': [
        { id: 'ws-live', name: 'Live', color: '#000', iconMode: 'emoji' },
        { id: 'ws-other', name: 'Other', color: '#000', iconMode: 'emoji' },
      ],
      'oh.runtimeActive.active': 'ws-live',
    });
    await H.scheduler.reconcileLiveSchedules(NOW);
    // One alarm for the (active) workspace's single workflow + null env
    // (no cache row yet).
    expect(alarmsCreateMock).toHaveBeenCalledTimes(1);
    const [name] = alarmsCreateMock.mock.calls[0];
    expect(name.startsWith('live-refresh:')).toBe(true);
  });

  it('handleAlarm cancels alarms whose workflow is missing from the per-workspace cache', async () => {
    // MWPT-FULL session #19: the v1.3 "workspace-mismatch → cancel"
    // guard is replaced with a per-workspace lookup. An alarm whose
    // payload references a workflow uid that doesn't exist in the
    // workspace's `LiveWorkflowCache` (workspace deleted, workflow
    // deleted, or never seeded) returns null from `getByAlarm` and the
    // shared scheduler still cancels — same orphan-cleanup contract,
    // just keyed on cache presence rather than Active matching.
    storeState.workflows = []; // workspace has no workflows for this uid
    storeState.variables = [];
    const orphanName = H.scheduler.buildAlarmName('ws-other', 'wflow001', null);
    await H.scheduler.handleLiveAlarm({
      name: orphanName,
      scheduledTime: Date.now(),
    } as chrome.alarms.Alarm);
    expect(alarmsClearMock).toHaveBeenCalledWith(orphanName);
  });
});

// ── Laptop sleep / wake-up resilience ─────────────────────────────
//
// These tests pin the contract that delivered the user-reported
// "fresh token on wake" fix: when the SW wakes after a long
// eviction (laptop closed, Chrome swapped out the worker), the
// scheduler must NOT silently drop alarms whose cache is past its
// cadence window. Every assertion here maps to a concrete failure
// mode we saw in production:
//   • cold-wake reconcile with a stale 6-hour-old cache must still
//     schedule an alarm (previously: the hydration race caused the
//     scheduler to see an empty workflow list, then clear every
//     `live-refresh:*` alarm as an "orphan").
//   • an overdue alarm firing during the race must not be the path
//     that deletes the alarm (fixed at the background.ts barrier,
//     verified here by confirming handleAlarm with a populated
//     store still runs the adapter and never calls cancelByPayload).

describe('laptop sleep / wake — stale-cache recovery', () => {
  it('reconcile after a 6h nap schedules at now+MIN_ALARM_DELAY (not the past-target)', async () => {
    // Cache from 6h ago with a 4h interval — next-fire was 2h ago.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000,
        expiresAt: NOW - 2 * 3600_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).toHaveBeenCalledOnce();
    const [, info] = alarmsCreateMock.mock.calls[0];
    // Clamped to the MV3 floor (+ up to 250ms reconcile jitter).
    expect(info.when).toBeGreaterThanOrEqual(NOW + H.scheduler.MIN_ALARM_DELAY_MS);
    expect(info.when).toBeLessThan(NOW + H.scheduler.MIN_ALARM_DELAY_MS + 300);
  });

  it('alarm that fires after the nap runs the refresh adapter (not the cancel path)', async () => {
    // Regression test for the hydration race: historically, handleAlarm
    // could race with a not-yet-hydrated workflow store and cancel the
    // alarm as "deleted." The background.ts barrier ensures the
    // scheduler only sees a populated store — simulated here by having
    // `storeState.workflows` pre-seeded before dispatch.
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000,
        expiresAt: NOW - 2 * 3600_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW - 2 * 3600_000,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).toHaveBeenCalledOnce();
    // Critically, the alarm was NOT cancelled.
    expect(alarmsClearMock).not.toHaveBeenCalledWith(H.scheduler.buildAlarmName('ws-live', 'wflow001', null));
  });

  it('reconcile survives an empty store — no alarm creates, no clears for unknown names', async () => {
    // Defense-in-depth: if reconcile ever runs on pre-hydration state
    // (empty workflows), it should reconcile to an empty desired set
    // but NOT clear alarms that belong to another subsystem.
    const foreignName = 'oauth-refresh:xxx';
    const liveName = H.scheduler.buildAlarmName('ws-live', 'wflow001', null);
    alarmsGetAllMock.mockResolvedValue([
      { name: foreignName, scheduledTime: NOW + 1_000 } as chrome.alarms.Alarm,
      { name: liveName, scheduledTime: NOW + 1_000 } as chrome.alarms.Alarm,
    ]);
    await H.scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
    // Foreign alarm was untouched (orphan sweep only walks our prefix).
    expect(alarmsClearMock).not.toHaveBeenCalledWith(foreignName);
    // Live alarm whose workflow was absent gets cleared (existing behavior).
    // With the background.ts barrier in place this is only reached after
    // hydration — so "absent workflow" genuinely means deleted, not a
    // pre-hydration race artifact.
    expect(alarmsClearMock).toHaveBeenCalledWith(liveName);
  });
});

// ── kickActiveContextRefresh — wake-up catch-up contract ──────────
//
// Called from background.ts after hydration + from workspace/env
// switches. Must drive an IMMEDIATE refresh (not via the 30s alarm
// floor) when a workflow's cached captures are past their cadence
// window, so first-request-after-wake doesn't 401 with a stale token.

describe('kickActiveContextRefresh', () => {
  it('fires immediate sync refresh for an overdue workflow', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000, // stale by 2h
        expiresAt: NOW - 2 * 3600_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    // Adapter is invoked inline (no alarm hop) so the first
    // post-wake request sees a fresh cache.
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('skips workflows that are still fresh within the cadence window', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 60_000, // 1 minute ago — next fire is in ~4h
        expiresAt: NOW + 4 * 3600_000 - 60_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('fires for a never-refreshed workflow (no cache row)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    // No caches entry — workflow has never refreshed.
    await H.scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('skips workflows with no enabled bindings', async () => {
    const refreshSpy = vi.fn();
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable({ enabled: false })];
    await H.scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('de-dupes refreshes when multiple LVs target the same workflow', async () => {
    // One workflow exposes two captures → two LVs bound to the same
    // workflow. Only one refresh should run — both LVs get their
    // value from the same chain execution.
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [
      makeVariable({ uid: 'lv0001a', name: 'token', captureName: 'v' }),
      makeVariable({ uid: 'lv0001b', name: 'userId', captureName: 'v' }),
    ];
    await H.scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('is env-scoped — fires for the active env even when another env is warm', async () => {
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: 'env-other', // different env has a fresh cache
        stepCaptures: {},
        extractedAt: NOW - 1000,
        expiresAt: NOW + 4 * 3600_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    // Switch to env-prod → it has no cache row → kick fires a refresh
    // for env-prod even though env-other is warm.
    await H.scheduler.kickActiveContextRefresh('ws-live', 'env-prod', NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
    const args = refreshSpy.mock.calls[0]?.[0];
    expect(args).toBeDefined();
    expect(args?.environmentId).toBe('env-prod');
  });
});
