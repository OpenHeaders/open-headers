/**
 * live-refresh-scheduler — alarm-driven background refresh for
 * `{{live.X}}` workflows. We mock `chrome.alarms`, the live stores,
 * and `observability-log` so each phase is exercised in isolation.
 */

import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────

const alarmsCreateMock = vi.fn<(name: string, info: chrome.alarms.AlarmCreateInfo) => void>();
const alarmsClearMock = vi.fn<(name: string) => void>();
const alarmsGetAllMock = vi.fn<() => Promise<chrome.alarms.Alarm[]>>();
const recordLogMock = vi.fn();
const recordRefreshErrorMock = vi.fn();

vi.mock('@utils/browser-api', () => ({
  alarms: {
    create: (name: string, info: chrome.alarms.AlarmCreateInfo) => alarmsCreateMock(name, info),
    clear: (name: string) => alarmsClearMock(name),
    getAll: () => alarmsGetAllMock(),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: (...args: unknown[]) => recordLogMock(...args),
}));

// Stores — hand-rolled stubs so the scheduler is exercised in isolation.
// The mocked `live-cache-store` surface returns a superset of
// WorkflowRunCache — tests don't need to set `circuit` explicitly
// for the healthy-path cases (the scheduler's `toCacheSummary`
// defaults a missing circuit to the initial closed snapshot). Cases
// that exercise circuit-driven cadence (open states, pre-breaker)
// set the field explicitly.
interface TestCacheRow {
  workflowUid: string;
  environmentId: string | null;
  stepCaptures: Record<string, Record<string, string>>;
  extractedAt: number;
  expiresAt: number | null;
  stepResponseBytes: Record<string, number>;
  consecutiveFailures: number;
  lastErrorAt?: number;
  lastErrorMessage?: string;
  lastErrorStepId?: string;
  lastExtractorOk: boolean;
  circuit?: {
    state: 'closed' | 'half-open' | 'open';
    consecutiveFailures: number;
    consecutiveOpenings: number;
    nextAttemptAt: number | null;
    halfOpenAttempts: number;
    lastSuccessAt: number | null;
    lastErrorAt: number | null;
  };
}

let storeState: {
  workflows: V5.LiveWorkflow[];
  variables: V5.LiveVariable[];
  requests: Map<string, V5.Request>;
  caches: TestCacheRow[];
  listeners: { workflow: Set<() => void>; variable: Set<() => void>; cache: Set<() => void> };
} = {
  workflows: [],
  variables: [],
  requests: new Map(),
  caches: [],
  listeners: { workflow: new Set(), variable: new Set(), cache: new Set() },
};

vi.mock('@/background/modules/live-workflow-store', () => ({
  getLiveWorkflows: () => storeState.workflows,
  // Per-workspace lookup (MWPT-FULL session #19): the test harness keeps
  // a single `storeState.workflows` list — return matches by uid
  // regardless of workspaceId so the existing single-workspace cases
  // continue to assert the same shape.
  getLiveWorkflowInWorkspace: (uid: string) => storeState.workflows.find((w) => w.uid === uid) ?? null,
  getLiveWorkflowsForWorkspace: () => storeState.workflows.slice(),
  onLiveWorkflowStoreChange: (fn: () => void) => {
    storeState.listeners.workflow.add(fn);
    return () => storeState.listeners.workflow.delete(fn);
  },
}));

vi.mock('@/background/modules/live-variable-store', () => ({
  getLiveVariables: () => storeState.variables.slice(),
  getLiveVariablesForWorkflow: (workflowUid: string) =>
    storeState.variables.filter((v) => v.workflowUid === workflowUid),
  getLiveVariablesForWorkspace: () => storeState.variables.slice(),
  getLiveVariablesForWorkflowInWorkspace: (workflowUid: string) =>
    storeState.variables.filter((v) => v.workflowUid === workflowUid),
  onLiveVariableStoreChange: (fn: () => void) => {
    storeState.listeners.variable.add(fn);
    return () => storeState.listeners.variable.delete(fn);
  },
}));

// Stub request-store — the dependency graph builder walks each step's
// persisted request for `{{live.X}}` refs. Tests that don't assert on
// the graph can leave the lookup returning `null` (no edges formed;
// reconcile degrades to a flat list). Cases that need specific refs
// seed `storeState.requests` explicitly.
vi.mock('@/background/modules/request-store', () => ({
  getRequest: (uid: string) => storeState.requests.get(uid) ?? null,
}));

vi.mock('@/background/modules/live-cache-store', () => ({
  listCachesForWorkflow: async (workflowUid: string) => storeState.caches.filter((c) => c.workflowUid === workflowUid),
  listWorkflowRunCaches: async () => storeState.caches.slice(),
  onLiveCacheStoreChange: (fn: () => void) => {
    storeState.listeners.cache.add(fn);
    return () => storeState.listeners.cache.delete(fn);
  },
  recordRefreshError: (...args: unknown[]) => recordRefreshErrorMock(...args),
}));

// Active-pointer change listeners — the scheduler subscribes to these
// on `startLiveScheduler` so a workspace/env switch automatically
// triggers `kickActiveContextRefresh`. The mocks expose the listener
// sets so tests can fire synthetic switches and verify reactivity.
const activeSwitchState = {
  workspaceListeners: new Set<(newId: string, prevId: string | null) => void>(),
  envListeners: new Set<(newId: string | null, prevId: string | null) => void>(),
  activeEnvId: null as string | null,
};

const ACTIVE_WORKSPACE_ID = 'ws-live';

vi.mock('@/background/modules/workspace-store', () => ({
  // The scheduler reads the active workspace synchronously from this
  // sync accessor when an env-switch event fires (workspace doesn't
  // change on env-switch but the listener doesn't carry it). Tests
  // that don't assert env-switch behavior don't need to override.
  getActiveWorkspaceId: () => ACTIVE_WORKSPACE_ID,
  onActiveWorkspaceChange: (fn: (newId: string, prevId: string | null) => void) => {
    activeSwitchState.workspaceListeners.add(fn);
    return () => activeSwitchState.workspaceListeners.delete(fn);
  },
}));

vi.mock('@/background/modules/environment-store', () => ({
  getActiveEnvironmentId: () => activeSwitchState.activeEnvId,
  onActiveEnvironmentChange: (fn: (newId: string | null, prevId: string | null) => void) => {
    activeSwitchState.envListeners.add(fn);
    return () => activeSwitchState.envListeners.delete(fn);
  },
}));

// Storage shim for OH.workspaces / OH.runtimeActive + wsKeys reads
// on inactive workspaces. Using `installBackingStorage` from the shared
// helper keeps the semantics identical to the real `extensionStorage`.
import { installBackingStorage, seedStorageMany } from '../helpers/chrome-storage-backing';

// ── Fixtures ──────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

function makeWorkflow(overrides: Partial<V5.LiveWorkflow> = {}): V5.LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wflow001',
    path: 'live-workflows/demo-wflow001',
    name: 'Demo',
    enabled: true,
    published: true,
    refresh: { kind: 'interval', seconds: 300 },
    steps: [
      {
        id: 'fetch',
        requestUid: 'reqfetch1',
        captures: [{ name: 'v', extractor: { kind: 'whole-body' } }],
      },
    ],
    ...overrides,
  };
}

function makeVariable(overrides: Partial<V5.LiveVariable> = {}): V5.LiveVariable {
  return {
    schemaVersion: 5,
    uid: 'livvar01',
    path: 'live-variables/demo-livvar01',
    name: 'authToken',
    workflowUid: 'wflow001',
    stepId: 'fetch',
    captureName: 'v',
    enabled: true,
    published: true,
    ...overrides,
  };
}

// ── Test harness ──────────────────────────────────────────────────

let scheduler: typeof import('@/background/modules/live-refresh-scheduler');

beforeEach(async () => {
  installBackingStorage();
  vi.resetModules();
  alarmsCreateMock.mockClear();
  alarmsClearMock.mockClear();
  alarmsGetAllMock.mockReset();
  alarmsGetAllMock.mockResolvedValue([]);
  recordLogMock.mockClear();
  recordRefreshErrorMock.mockClear();
  storeState = {
    workflows: [],
    variables: [],
    requests: new Map(),
    caches: [],
    listeners: { workflow: new Set(), variable: new Set(), cache: new Set() },
  };
  activeSwitchState.workspaceListeners.clear();
  activeSwitchState.envListeners.clear();
  activeSwitchState.activeEnvId = null;
  // Seed an active workspace so `collectEntries` can route the
  // in-memory path.
  seedStorageMany({
    'oh.workspaces': [{ id: 'ws-live', name: 'Live', color: '#000', iconMode: 'emoji' }],
    'oh.runtimeActive.active': 'ws-live',
  });
  scheduler = await import('@/background/modules/live-refresh-scheduler');
  scheduler.__setLiveRefreshAdapter(null);
});

afterEach(() => {
  scheduler.stopLiveScheduler();
});

// ── Alarm name codec ──────────────────────────────────────────────

describe('alarm name codec', () => {
  it('round-trips (workspaceId, workflowUid, environmentId)', () => {
    const name = scheduler.buildAlarmName('ws-1', 'wflow001', 'env-prod');
    expect(name.startsWith('live-refresh:')).toBe(true);
    expect(scheduler.parseAlarmName(name)).toEqual({
      workspaceId: 'ws-1',
      workflowUid: 'wflow001',
      environmentId: 'env-prod',
    });
  });

  it('round-trips null environment id', () => {
    const name = scheduler.buildAlarmName('ws-1', 'wflow001', null);
    expect(scheduler.parseAlarmName(name)?.environmentId).toBeNull();
  });

  it('returns null for non-live alarms', () => {
    expect(scheduler.parseAlarmName('oauth-refresh:xxx')).toBeNull();
    expect(scheduler.parseAlarmName('unrelated')).toBeNull();
  });

  it('isLiveRefreshAlarm filters correctly', () => {
    expect(
      scheduler.isLiveRefreshAlarm({ name: scheduler.buildAlarmName('a', 'b', null) } as chrome.alarms.Alarm),
    ).toBe(true);
    expect(scheduler.isLiveRefreshAlarm({ name: 'oauth-refresh:x' } as chrome.alarms.Alarm)).toBe(false);
  });
});

// ── canScheduleWorkflow ───────────────────────────────────────────

describe('canScheduleWorkflow', () => {
  it('true when workflow is enabled AND has at least one enabled LV', () => {
    expect(scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(true);
  });

  it('false when workflow is disabled', () => {
    expect(scheduler.canScheduleWorkflow(makeWorkflow({ enabled: false }), [makeVariable()])).toBe(false);
  });

  it('false when no enabled LV is bound to the workflow', () => {
    expect(scheduler.canScheduleWorkflow(makeWorkflow(), [])).toBe(false);
    expect(scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable({ enabled: false })])).toBe(false);
  });
});

// ── Schedule + cancel ─────────────────────────────────────────────

describe('scheduleLiveWorkflowRefresh', () => {
  it('creates an alarm for an eligible interval-based workflow', async () => {
    const scheduled = await scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } }),
        boundVariables: [makeVariable()],
        cache: null,
        environmentId: null,
      },
      NOW,
    );
    expect(scheduled).toBe(true);
    expect(alarmsCreateMock).toHaveBeenCalledOnce();
    const [name, info] = alarmsCreateMock.mock.calls[0];
    expect(name).toBe(scheduler.buildAlarmName('ws-live', 'wflow001', null));
    expect(info.when).toBe(NOW + scheduler.MIN_ALARM_DELAY_MS);
  });

  it('skips + cancels manual-policy workflows', async () => {
    const scheduled = await scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ refresh: { kind: 'manual' } }),
        boundVariables: [makeVariable()],
        cache: null,
        environmentId: null,
      },
      NOW,
    );
    expect(scheduled).toBe(false);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalled();
  });

  it('cancels alarm for disabled / unbound workflows', async () => {
    await scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ enabled: false }),
        boundVariables: [makeVariable()],
        cache: null,
        environmentId: null,
      },
      NOW,
    );
    expect(alarmsCreateMock).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalled();
  });

  it('cancelLiveWorkflowRefresh clears the alarm by name', async () => {
    await scheduler.cancelLiveWorkflowRefresh('ws-live', 'wflow001', 'env-prod');
    expect(alarmsClearMock).toHaveBeenCalledWith(scheduler.buildAlarmName('ws-live', 'wflow001', 'env-prod'));
  });
});

// ── Cache summary projection ──────────────────────────────────────

describe('toCacheSummary', () => {
  it('returns null for null input', () => {
    expect(scheduler.toCacheSummary(null)).toBeNull();
  });

  it('projects extractedAt / captures / failure state + circuit snapshot', () => {
    const circuit = {
      state: 'closed' as const,
      consecutiveFailures: 2,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: NOW - 30_000,
    };
    const summary = scheduler.toCacheSummary({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: { fetch: { v: 'x' } },
      extractedAt: NOW - 10_000,
      expiresAt: null,
      stepResponseBytes: {},
      consecutiveFailures: 2,
      lastErrorAt: NOW - 30_000,
      lastExtractorOk: false,
      circuit,
    });
    expect(summary).toEqual({
      extractedAt: NOW - 10_000,
      stepCaptures: { fetch: { v: 'x' } },
      consecutiveFailures: 2,
      lastErrorAt: NOW - 30_000,
      circuit,
    });
  });

  it('defaults missing circuit to the initial closed snapshot', () => {
    // Normalize-on-read is the belt; this is the braces. toCacheSummary
    // must project a usable circuit even when the input row predates
    // the field — the cadence path dereferences `circuit.state` without
    // guarding.
    const summary = scheduler.toCacheSummary({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      extractedAt: NOW,
      expiresAt: null,
      stepResponseBytes: {},
      consecutiveFailures: 0,
      lastExtractorOk: true,
      // circuit: absent
    } as unknown as Parameters<typeof scheduler.toCacheSummary>[0]);
    expect(summary?.circuit).toEqual({
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
    });
  });
});

// ── Reconcile ─────────────────────────────────────────────────────

describe('reconcileLiveSchedules', () => {
  it('schedules every eligible workflow in the active workspace', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflow001' }), makeWorkflow({ uid: 'wflow002', name: 'Other' })];
    storeState.variables = [makeVariable({ workflowUid: 'wflow001' }), makeVariable({ workflowUid: 'wflow002' })];
    await scheduler.reconcileLiveSchedules(NOW);
    // Two workflows × one implicit env (null) = two alarms.
    expect(alarmsCreateMock).toHaveBeenCalledTimes(2);
  });

  it('clears orphan alarms whose workflow no longer exists', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflow001' })];
    storeState.variables = [makeVariable({ workflowUid: 'wflow001' })];
    // Pretend there's an orphan alarm from a previous scheduler run.
    const orphanName = scheduler.buildAlarmName('ws-live', 'wflow-ghost', null);
    const liveName = scheduler.buildAlarmName('ws-live', 'wflow001', null);
    alarmsGetAllMock.mockResolvedValue([
      { name: orphanName, scheduledTime: NOW + 100_000 } as chrome.alarms.Alarm,
      { name: liveName, scheduledTime: NOW + 200_000 } as chrome.alarms.Alarm,
    ]);
    await scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsClearMock).toHaveBeenCalledWith(orphanName);
    expect(alarmsClearMock).not.toHaveBeenCalledWith(liveName);
  });

  it('schedules per-env-cache so env switches expose distinct alarms', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflow001' })];
    storeState.variables = [makeVariable({ workflowUid: 'wflow001' })];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: 'env-prod',
        stepCaptures: {},
        extractedAt: NOW - 10_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
      {
        workflowUid: 'wflow001',
        environmentId: 'env-dev',
        stepCaptures: {},
        extractedAt: NOW - 10_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await scheduler.reconcileLiveSchedules(NOW);
    // Two env-keyed cache rows → two alarms (one per env).
    expect(alarmsCreateMock).toHaveBeenCalledTimes(2);
    const names = alarmsCreateMock.mock.calls.map(([n]) => n);
    expect(names.sort()).toEqual(
      [
        scheduler.buildAlarmName('ws-live', 'wflow001', 'env-dev'),
        scheduler.buildAlarmName('ws-live', 'wflow001', 'env-prod'),
      ].sort(),
    );
  });

  it('does not schedule workflows with no enabled LV bindings', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = []; // no LVs bound
    await scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
  });
});

// ── handleLiveAlarm dispatch ──────────────────────────────────────

describe('handleLiveAlarm', () => {
  it('records scheduler-not-ready when no adapter is installed', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).toHaveBeenCalledOnce();
    const arg = recordRefreshErrorMock.mock.calls[0][0];
    expect(arg.workflowUid).toBe('wflow001');
    expect(arg.message).toContain('scheduler-not-ready');
  });

  it('calls the installed adapter on successful dispatch', async () => {
    type RefreshArgs = { workspaceId: string; workflow: V5.LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', 'env-prod'),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).toHaveBeenCalledOnce();
    const arg = refreshSpy.mock.calls[0][0];
    expect(arg.workspaceId).toBe('ws-live');
    expect(arg.workflow.uid).toBe('wflow001');
    expect(arg.environmentId).toBe('env-prod');
  });

  it('records a refresh-succeeded log entry when the adapter resolves', async () => {
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    const ops = recordLogMock.mock.calls.map((call) => (call[0] as { op: string }).op);
    expect(ops).toContain('refresh-fired');
    expect(ops).toContain('refresh-succeeded');
  });

  it('catches adapter rejections and records a refresh-failed entry', async () => {
    scheduler.__setLiveRefreshAdapter({
      refreshWorkflow: async () => {
        throw new Error('boom');
      },
    });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).toHaveBeenCalled();
    const ops = recordLogMock.mock.calls.map((call) => (call[0] as { op: string }).op);
    expect(ops).toContain('refresh-failed');
  });

  it('cancels the alarm when the workflow no longer exists', async () => {
    const refreshSpy = vi.fn();
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    // Nothing in storeState.workflows → handler treats as deleted.
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow-gone', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalledWith(scheduler.buildAlarmName('ws-live', 'wflow-gone', null));
  });

  it('ignores non-live alarms (wrong prefix)', async () => {
    await scheduler.handleLiveAlarm({ name: 'oauth-refresh:xxx', scheduledTime: NOW } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    expect(recordLogMock).not.toHaveBeenCalled();
  });
});

// ── Lifecycle + store-change reconcile ────────────────────────────

describe('startLiveScheduler', () => {
  it('subscribes to every live store and reconciles on change', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(1);
    expect(storeState.listeners.variable.size).toBe(1);
    expect(storeState.listeners.cache.size).toBe(1);

    alarmsCreateMock.mockClear();
    // Simulate a workflow-store mutation.
    for (const fn of storeState.listeners.workflow) fn();
    // Reconcile is async (fire-and-forget); wait a microtask.
    await new Promise((r) => setTimeout(r, 0));
    expect(alarmsCreateMock).toHaveBeenCalled();
  });

  it('stopLiveScheduler tears down every listener', () => {
    scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(1);
    scheduler.stopLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(0);
    expect(storeState.listeners.variable.size).toBe(0);
    expect(storeState.listeners.cache.size).toBe(0);
  });

  it('is idempotent — a second start call does not double-subscribe', () => {
    scheduler.startLiveScheduler();
    scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(1);
  });

  it('subscribes to active-workspace + active-env switch events', () => {
    scheduler.startLiveScheduler();
    expect(activeSwitchState.workspaceListeners.size).toBe(1);
    expect(activeSwitchState.envListeners.size).toBe(1);
    scheduler.stopLiveScheduler();
    expect(activeSwitchState.workspaceListeners.size).toBe(0);
    expect(activeSwitchState.envListeners.size).toBe(0);
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
    await scheduler.reconcileLiveSchedules(NOW);
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
    const orphanName = scheduler.buildAlarmName('ws-other', 'wflow001', null);
    await scheduler.handleLiveAlarm({
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
    await scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).toHaveBeenCalledOnce();
    const [, info] = alarmsCreateMock.mock.calls[0];
    // Clamped to the MV3 floor (+ up to 250ms reconcile jitter).
    expect(info.when).toBeGreaterThanOrEqual(NOW + scheduler.MIN_ALARM_DELAY_MS);
    expect(info.when).toBeLessThan(NOW + scheduler.MIN_ALARM_DELAY_MS + 300);
  });

  it('alarm that fires after the nap runs the refresh adapter (not the cancel path)', async () => {
    // Regression test for the hydration race: historically, handleAlarm
    // could race with a not-yet-hydrated workflow store and cancel the
    // alarm as "deleted." The background.ts barrier ensures the
    // scheduler only sees a populated store — simulated here by having
    // `storeState.workflows` pre-seeded before dispatch.
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW - 2 * 3600_000,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).toHaveBeenCalledOnce();
    // Critically, the alarm was NOT cancelled.
    expect(alarmsClearMock).not.toHaveBeenCalledWith(scheduler.buildAlarmName('ws-live', 'wflow001', null));
  });

  it('reconcile survives an empty store — no alarm creates, no clears for unknown names', async () => {
    // Defense-in-depth: if reconcile ever runs on pre-hydration state
    // (empty workflows), it should reconcile to an empty desired set
    // but NOT clear alarms that belong to another subsystem.
    const foreignName = 'oauth-refresh:xxx';
    const liveName = scheduler.buildAlarmName('ws-live', 'wflow001', null);
    alarmsGetAllMock.mockResolvedValue([
      { name: foreignName, scheduledTime: NOW + 1_000 } as chrome.alarms.Alarm,
      { name: liveName, scheduledTime: NOW + 1_000 } as chrome.alarms.Alarm,
    ]);
    await scheduler.reconcileLiveSchedules(NOW);
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    await scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    // Adapter is invoked inline (no alarm hop) so the first
    // post-wake request sees a fresh cache.
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('skips workflows that are still fresh within the cadence window', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    await scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('fires for a never-refreshed workflow (no cache row)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    // No caches entry — workflow has never refreshed.
    await scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('skips workflows with no enabled bindings', async () => {
    const refreshSpy = vi.fn();
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable({ enabled: false })];
    await scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('de-dupes refreshes when multiple LVs target the same workflow', async () => {
    // One workflow exposes two captures → two LVs bound to the same
    // workflow. Only one refresh should run — both LVs get their
    // value from the same chain execution.
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [
      makeVariable({ uid: 'lv0001a', name: 'token', captureName: 'v' }),
      makeVariable({ uid: 'lv0001b', name: 'userId', captureName: 'v' }),
    ];
    await scheduler.kickActiveContextRefresh('ws-live', null, NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('is env-scoped — fires for the active env even when another env is warm', async () => {
    type RefreshArgs = { workspaceId: string; workflow: V5.LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    await scheduler.kickActiveContextRefresh('ws-live', 'env-prod', NOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshSpy).toHaveBeenCalledOnce();
    const args = refreshSpy.mock.calls[0]?.[0];
    expect(args).toBeDefined();
    expect(args?.environmentId).toBe('env-prod');
  });
});

// ── Network-failure modes (VPN disconnected, internet down) ───────
//
// The scheduler's contract when the adapter rejects: record the
// failure (so consecutiveFailures increments → cadence math picks
// up the backoff on the NEXT reconcile) and emit a refresh-failed
// log. The alarm ID stays the same across failures — one logical
// alarm per (workspace, workflow, env), whose `when` changes as
// failures accumulate. Tests here pin that invariant.

describe('network failure modes', () => {
  it('adapter throwing (e.g. ECONNREFUSED / VPN dropped) records failure and logs refresh-failed', async () => {
    scheduler.__setLiveRefreshAdapter({
      refreshWorkflow: async () => {
        // Realistic shape for a VPN-dropped fetch: the platform surfaces
        // as "Failed to fetch" / net::ERR_NETWORK_CHANGED up the stack.
        throw new Error('net::ERR_NETWORK_CHANGED');
      },
    });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).toHaveBeenCalledOnce();
    const arg = recordRefreshErrorMock.mock.calls[0][0];
    expect(arg.message).toContain('net::ERR_NETWORK_CHANGED');
    // extractorOk=false signals a fetch-phase failure; the cache
    // store preserves last-good captures on this path.
    expect(arg.extractorOk).toBe(false);
    const ops = recordLogMock.mock.calls.map((c) => (c[0] as { op: string }).op);
    expect(ops).toContain('refresh-failed');
  });

  it('reconcile after a closed-state failure schedules at the pre-breaker tier (5s + jitter)', async () => {
    // Circuit is CLOSED with 1 consecutive failure (pre-breaker tier —
    // first two failures don't open the circuit). Cadence math picks
    // `lastErrorAt + 5s + jitter(0..5s)` per `computePreBreakerDelayMs`.
    // Since lastErrorAt is 10s ago and the tier adds up to 10s, the
    // computed target is in the past and the MV3 30s floor clamps.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 4 * 3600_000,
        expiresAt: NOW,
        stepResponseBytes: {},
        consecutiveFailures: 1,
        lastErrorAt: NOW - 10_000,
        lastErrorMessage: 'net::ERR_NETWORK_CHANGED',
        lastExtractorOk: false,
        circuit: {
          state: 'closed',
          consecutiveFailures: 1,
          consecutiveOpenings: 0,
          nextAttemptAt: null,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW - 10_000,
        },
      },
    ];
    await scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).toHaveBeenCalledOnce();
    const [, info] = alarmsCreateMock.mock.calls[0];
    // Clamped to `now + MIN_ALARM_DELAY_MS` plus reconcile-wave jitter.
    expect(info.when).toBeGreaterThanOrEqual(NOW + scheduler.MIN_ALARM_DELAY_MS);
    expect(info.when).toBeLessThan(NOW + scheduler.MIN_ALARM_DELAY_MS + 300);
  });

  it('reconcile with circuit OPEN schedules exactly at nextAttemptAt', async () => {
    // Circuit OPEN with nextAttemptAt 60s in the future — the alarm
    // MUST fire at that moment so the probe happens on schedule.
    // Matches v4 AdaptiveCircuitBreaker.nextAttemptTime semantics.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    const nextAttemptAt = NOW + 60_000;
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 3,
        lastErrorAt: NOW - 1000,
        lastErrorMessage: 'boom',
        lastExtractorOk: false,
        circuit: {
          state: 'open',
          consecutiveFailures: 3,
          consecutiveOpenings: 1,
          nextAttemptAt,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW - 1000,
        },
      },
    ];
    await scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBeGreaterThanOrEqual(nextAttemptAt);
    expect(info.when).toBeLessThan(nextAttemptAt + 300);
  });

  it('circuit OPEN with deep consecutiveOpenings history uses longer backoff window', async () => {
    // consecutiveOpenings=4 → BASE × 2^3 = 240s. Same effective
    // behavior as v4's circuit-breaker after 4 open cycles.
    const nextAttemptAt = NOW + 240_000;
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 6,
        lastErrorAt: NOW,
        lastErrorMessage: 'boom',
        lastExtractorOk: false,
        circuit: {
          state: 'open',
          consecutiveFailures: 6,
          consecutiveOpenings: 4,
          nextAttemptAt,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW,
        },
      },
    ];
    await scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBeGreaterThanOrEqual(nextAttemptAt);
    expect(info.when).toBeLessThan(nextAttemptAt + 300);
  });

  it('does not create a new alarm name per failure — one logical alarm per (ws, workflow, env)', async () => {
    scheduler.__setLiveRefreshAdapter({
      refreshWorkflow: async () => {
        throw new Error('boom');
      },
    });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    const aname = scheduler.buildAlarmName('ws-live', 'wflow001', null);
    // Fire the alarm twice in a row (simulating two backoff ticks
    // failing in sequence) and verify the alarm identity is stable.
    await scheduler.handleLiveAlarm({ name: aname, scheduledTime: NOW } as chrome.alarms.Alarm);
    await scheduler.handleLiveAlarm({ name: aname, scheduledTime: NOW + 60_000 } as chrome.alarms.Alarm);
    // Two failure records, same alarm identity.
    expect(recordRefreshErrorMock).toHaveBeenCalledTimes(2);
    const firstKey = scheduler.buildAlarmName(
      (recordRefreshErrorMock.mock.calls[0][1] as string) ?? 'ws-live',
      recordRefreshErrorMock.mock.calls[0][0].workflowUid,
      recordRefreshErrorMock.mock.calls[0][0].environmentId,
    );
    expect(firstKey).toBe(aname);
  });
});

// ── Timezone + system-clock edge cases ────────────────────────────
//
// `computeNextFireAt` operates purely in ms-since-epoch — there is no
// timezone arithmetic anywhere in the cadence path, and Chrome's
// `alarms.create({ when })` takes the same absolute-ms value. These
// tests pin that contract so a future refactor can't accidentally
// introduce a `Date.parse`/`toLocaleString` drift.

describe('timezone + clock-skew invariance', () => {
  it('healthy-path when is derived from extractedAt, not nowMs (two close calls agree modulo jitter)', async () => {
    // Cache is well within the cadence window for both nowMs values
    // below, so `computeNextFireAt` returns `extractedAt + 300s` both
    // times and the MIN_ALARM floor never engages. Verifies the
    // cadence path is pinned to persisted extractedAt (tz-neutral)
    // rather than wall-clock arithmetic that might drift through
    // `new Date(...)` / `toLocaleString(...)`. The reconcile wave
    // adds 0–250ms random jitter on top (thundering-herd spread), so
    // the assertion is "both in the same 300ms window around the
    // target" rather than exact equality.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 1000,
        expiresAt: NOW + 299_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    const healthyTarget = NOW - 1000 + 300_000;
    await scheduler.reconcileLiveSchedules(NOW);
    const firstWhen = alarmsCreateMock.mock.calls[0]?.[1]?.when;
    expect(firstWhen).toBeDefined();
    expect(firstWhen!).toBeGreaterThanOrEqual(healthyTarget);
    expect(firstWhen!).toBeLessThan(healthyTarget + 300);
    alarmsCreateMock.mockClear();
    // Nudge nowMs forward by one minute — still well inside the
    // healthy window (target is at NOW+299s, floor is at NOW+60s+30s).
    await scheduler.reconcileLiveSchedules(NOW + 60_000);
    const secondWhen = alarmsCreateMock.mock.calls[0]?.[1]?.when;
    expect(secondWhen).toBeDefined();
    expect(secondWhen!).toBeGreaterThanOrEqual(healthyTarget);
    expect(secondWhen!).toBeLessThan(healthyTarget + 300);
  });

  it('clock jumping far forward clamps via nowMs (NOT via Date.now) — the injected nowMs wins', async () => {
    // When the computed target is in the past relative to `nowMs`,
    // the clamp moves `when` to `nowMs + MIN_ALARM_DELAY`. This test
    // pins that the INJECTED nowMs (not a leaked Date.now()) drives
    // the clamp — so a DST rollover / VM snapshot resume / NTP jump
    // can be simulated deterministically in tests without monkey-
    // patching globalThis.Date.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 1000,
        expiresAt: NOW + 299_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    const jumpedNow = NOW + 7 * 24 * 3600_000; // 7 days ahead
    await scheduler.reconcileLiveSchedules(jumpedNow);
    const when = alarmsCreateMock.mock.calls[0]?.[1]?.when;
    expect(when).toBeDefined();
    expect(when!).toBeGreaterThanOrEqual(jumpedNow + scheduler.MIN_ALARM_DELAY_MS);
    expect(when!).toBeLessThan(jumpedNow + scheduler.MIN_ALARM_DELAY_MS + 300);
  });

  it('clock jumping forward past the target re-arms at now+MIN_ALARM_DELAY', async () => {
    // e.g. user was asleep, laptop's RTC is now 10h ahead of when the
    // cache was stamped. Target = extractedAt + 300s is far in the past;
    // the scheduler must clamp rather than emit a when that Chrome
    // would treat as "fire immediately but burn alarm quota doing it."
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 10 * 3600_000,
        expiresAt: NOW - 10 * 3600_000 + 300_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBeGreaterThanOrEqual(NOW + scheduler.MIN_ALARM_DELAY_MS);
  });

  it('clock rolling backward still respects extractedAt (no negative intervals)', async () => {
    // Pathological: user manually set the system clock earlier than
    // extractedAt (VM restored from a snapshot; NTP correction after
    // boot on a drifted RTC). extractedAt is "future" relative to
    // nowMs — target = extractedAt + 300s is also future, the
    // scheduler just schedules farther out. No crash, no negative ms.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    const futureExtractedAt = NOW + 60 * 3600_000; // "extracted 60h from now"
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: futureExtractedAt,
        expiresAt: futureExtractedAt + 300_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    // Healthy-path target (extractedAt + 300s) wins — far in the
    // future, no clamp needed, and crucially > NOW.
    expect(info.when).toBeGreaterThan(NOW);
    expect(info.when).toBeGreaterThanOrEqual(futureExtractedAt + 300_000);
  });
});

// ── Offline gate ──────────────────────────────────────────────────
//
// When `navigator.onLine === false`, refresh attempts must skip
// cleanly — no adapter call, no circuit transition, no cache write.
// The v4 equivalent paused the refresh scheduler on `NetworkService
// 'offline'`; v5 checks the SW's `navigator.onLine` signal at each
// dispatch + at every manual click. Tests here pin the contract that
// offline blips DON'T rip through all three pre-breaker retries and
// open the circuit in 90 seconds (the MV3 alarm floor clamps 5–10s
// intended retries to 30s apiece).

describe('offline gate', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');

  function setOnline(value: boolean): void {
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(globalThis.navigator, 'onLine', originalOnLine);
  });

  it('alarm fire while offline does NOT call the adapter', async () => {
    const refreshSpy = vi.fn();
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    setOnline(false);
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('alarm fire while offline does NOT record a circuit failure', async () => {
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    setOnline(false);
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    // `recordRefreshError` is the cache-mutation path. An offline skip
    // must not call it — the circuit stays where it was.
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
  });

  it('alarm fire while offline logs at info level with errorClass=Offline', async () => {
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    setOnline(false);
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    const failedLog = recordLogMock.mock.calls.find((c) => (c[0] as { op: string }).op === 'refresh-failed');
    expect(failedLog).toBeDefined();
    const entry = failedLog?.[0] as { level: string; context: { errorClass: string } };
    expect(entry.level).toBe('info');
    expect(entry.context.errorClass).toBe('Offline');
  });

  it('offline path re-schedules the alarm so a post-online catch-up fires naturally', async () => {
    // recordFailure's CircuitBlocked/Offline branch calls scheduler
    // .schedule(job) explicitly because no cache-change event fires.
    // That keeps the alarm live — when the 'online' handler runs
    // reconcileLiveSchedules, the next computed `when` (= healthy
    // cadence) takes over.
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 60_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    alarmsCreateMock.mockClear();
    setOnline(false);
    await scheduler.handleLiveAlarm({
      name: scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(alarmsCreateMock).toHaveBeenCalled();
  });
});
