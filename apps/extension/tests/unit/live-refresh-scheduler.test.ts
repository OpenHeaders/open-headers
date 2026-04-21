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
let storeState: {
  workflows: V5.LiveWorkflow[];
  variables: V5.LiveVariable[];
  requests: Map<string, V5.Request>;
  caches: Array<{
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
  }>;
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
  onLiveWorkflowStoreChange: (fn: () => void) => {
    storeState.listeners.workflow.add(fn);
    return () => storeState.listeners.workflow.delete(fn);
  },
}));

vi.mock('@/background/modules/live-variable-store', () => ({
  getLiveVariables: () => storeState.variables.slice(),
  getLiveVariablesForWorkflow: (workflowUid: string) =>
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

// Storage shim for OH.workspaces / OH.activeWorkspaceId + wsKeys reads
// on inactive workspaces. Using `installBackingStorage` from the shared
// helper keeps the semantics identical to the real `extensionStorage`.
import { installBackingStorage, seedStorageMany } from '../helpers/chrome-storage-backing';

// ── Fixtures ──────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

function makeWorkflow(overrides: Partial<V5.LiveWorkflow> = {}): V5.LiveWorkflow {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'wflow001',
    path: 'live-workflows/demo-wflow001',
    name: 'Demo',
    enabled: true,
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
    version: 1,
    uid: 'livvar01',
    path: 'live-variables/demo-livvar01',
    name: 'authToken',
    workflowUid: 'wflow001',
    stepId: 'fetch',
    captureName: 'v',
    enabled: true,
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
  // Seed an active workspace so `collectEntries` can route the
  // in-memory path.
  seedStorageMany({
    'oh.workspaces': [{ id: 'ws-live', name: 'Live', color: '#000', iconMode: 'emoji' }],
    'oh.activeWorkspaceId': 'ws-live',
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

  it('projects extractedAt / captures / failure state', () => {
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
    });
    expect(summary).toEqual({
      extractedAt: NOW - 10_000,
      stepCaptures: { fetch: { v: 'x' } },
      consecutiveFailures: 2,
      lastErrorAt: NOW - 30_000,
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
});
