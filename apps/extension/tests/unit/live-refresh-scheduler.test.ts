/**
 * live-refresh-scheduler — alarm-driven background refresh for
 * `{{live.X}}` workflows. We mock `chrome.alarms`, the live stores,
 * and `observability-log` so each phase is exercised in isolation.
 */

import type {
  Collection,
  Environment,
  LiveVariable,
  LiveWorkflow,
  Request,
  Vault,
  WorkflowRunCache,
  WorkflowStep,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────

const alarmsCreateMock = vi.fn<(name: string, info: chrome.alarms.AlarmCreateInfo) => void>();
const alarmsClearMock = vi.fn<(name: string) => void>();
const alarmsGetAllMock = vi.fn<() => Promise<chrome.alarms.Alarm[]>>();
const recordLogMock = vi.fn();
const recordRefreshErrorMock = vi.fn();
const clearWorkflowRunCacheMock = vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0);
const clearWorkflowRunCacheForEnvironmentMock = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
const markWorkflowDefinitionallyStaleMock = vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0);
const markRunDefinitionallyStaleMock = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);

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

// Stub the workspace-service refcount bracket the scheduler now uses
// for cross-workspace residency. The real implementation pulls in
// `service.ts` (and transitively `variables-resolver`, which registers
// a module-level `onLiveCacheStoreChange` listener at import time —
// would skew the listener-count assertions below). Tests don't need
// the bracket's behavior; they exercise the scheduler with the active
// workspace already wired by the mocked stores.
vi.mock('@openheaders/oracle/sync/service', () => ({
  getOrCreateWorkspaceService: () => ({ hydrated: Promise.resolve() }),
  releaseWorkspaceService: () => {},
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

const EMPTY_VAULT: Vault = { schemaVersion: 5, secrets: [] };
const EMPTY_WORKSPACE_VARS: WorkspaceVariables = { schemaVersion: 5, variables: [] };

let storeState: {
  workflows: LiveWorkflow[];
  variables: LiveVariable[];
  requests: Map<string, Request>;
  caches: TestCacheRow[];
  environments: Environment[];
  vault: Vault;
  workspaceVars: WorkspaceVariables;
  requestCollections: Collection[];
  requestStoreHydrated: boolean;
  listeners: {
    workflow: Set<() => void>;
    variable: Set<() => void>;
    cache: Set<(workspaceId: string, workflowUid: string | null, runs: readonly WorkflowRunCache[]) => void>;
    request: Set<() => void>;
    environment: Set<() => void>;
  };
} = {
  workflows: [],
  variables: [],
  requests: new Map(),
  caches: [],
  environments: [],
  vault: EMPTY_VAULT,
  workspaceVars: EMPTY_WORKSPACE_VARS,
  requestCollections: [],
  requestStoreHydrated: false,
  listeners: { workflow: new Set(), variable: new Set(), cache: new Set(), request: new Set(), environment: new Set() },
};

vi.mock('@openheaders/oracle/live/live-workflow-store', () => ({
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

vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
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
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: (uid: string) => storeState.requests.get(uid) ?? null,
  getRequestCollections: () => storeState.requestCollections,
  isRequestStoreHydrated: () => storeState.requestStoreHydrated,
  onRequestStoreChange: (fn: () => void) => {
    storeState.listeners.request.add(fn);
    return () => storeState.listeners.request.delete(fn);
  },
}));

vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  listCachesForWorkflow: async (workflowUid: string) => storeState.caches.filter((c) => c.workflowUid === workflowUid),
  listWorkflowRunCaches: async () => storeState.caches.slice(),
  onLiveCacheStoreChange: (
    fn: (workspaceId: string, workflowUid: string | null, runs: readonly WorkflowRunCache[]) => void,
  ) => {
    storeState.listeners.cache.add(fn);
    return () => storeState.listeners.cache.delete(fn);
  },
  recordRefreshError: (...args: unknown[]) => recordRefreshErrorMock(...args),
  clearWorkflowRunCache: (...args: unknown[]) => clearWorkflowRunCacheMock(...args),
  clearWorkflowRunCacheForEnvironment: (...args: unknown[]) => clearWorkflowRunCacheForEnvironmentMock(...args),
  markWorkflowDefinitionallyStale: (...args: unknown[]) => markWorkflowDefinitionallyStaleMock(...args),
  markRunDefinitionallyStale: (...args: unknown[]) => markRunDefinitionallyStaleMock(...args),
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

// Mutable so cross-workspace cases can simulate a switch — most tests
// leave it at the default `'ws-live'`.
let ACTIVE_WORKSPACE_ID = 'ws-live';

// Both the shim (`@/background/modules/workspace-store`, what the
// scheduler imports) and the canonical path (what the lifted
// definitional-freshness module imports) resolve to the same accessors;
// mock both against the one `activeSwitchState` closure so a workspace
// subscription from either side lands in the same set.
// Hoisted function declaration (not a `const`) so the hoisted `vi.mock`
// calls below can reference it without hitting the temporal dead zone.
function workspaceStoreMock() {
  return {
    // The scheduler reads the active workspace synchronously from this
    // sync accessor when an env-switch event fires (workspace doesn't
    // change on env-switch but the listener doesn't carry it). Tests
    // that don't assert env-switch behavior don't need to override.
    getActiveWorkspaceId: () => ACTIVE_WORKSPACE_ID,
    onActiveWorkspaceChange: (fn: (newId: string, prevId: string | null) => void) => {
      activeSwitchState.workspaceListeners.add(fn);
      return () => activeSwitchState.workspaceListeners.delete(fn);
    },
  };
}
vi.mock('@/background/modules/workspace-store', workspaceStoreMock);
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', workspaceStoreMock);

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => activeSwitchState.activeEnvId,
  getEnvironments: () => storeState.environments,
  getVault: () => storeState.vault,
  getWorkspaceVariables: () => storeState.workspaceVars,
  onActiveEnvironmentChange: (fn: (newId: string | null, prevId: string | null) => void) => {
    activeSwitchState.envListeners.add(fn);
    return () => activeSwitchState.envListeners.delete(fn);
  },
  onEnvironmentStoreChange: (fn: () => void) => {
    storeState.listeners.environment.add(fn);
    return () => storeState.listeners.environment.delete(fn);
  },
}));

// Storage shim for OH.workspaces / OH.runtimeActive + wsKeys reads
// on inactive workspaces. Using `installBackingStorage` from the shared
// helper keeps the semantics identical to the real `extensionStorage`.
import { installBackingStorage, installHostStorage, seedStorageMany } from '../helpers/chrome-storage-backing';

// ── Fixtures ──────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

function makeWorkflow(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
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
        uid: 'stpfetch',
        id: 'fetch',
        requestUid: 'reqfetch1',
        captures: [{ uid: 'capvxxxx', name: 'v', extractor: { kind: 'whole-body' } }],
      },
    ],
    ...overrides,
  };
}

function makeVariable(overrides: Partial<LiveVariable> = {}): LiveVariable {
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

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'reqfetch1',
    path: 'requests/demo-reqfetch1',
    name: 'Fetch token',
    method: 'GET',
    url: 'https://api.openheaders.io/token',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

/** Drain the debounce timer + the chain of detached async hops. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
}

// ── Test harness ──────────────────────────────────────────────────

let scheduler: typeof import('@/background/modules/live-refresh-scheduler');

beforeEach(async () => {
  installBackingStorage();
  vi.resetModules();
  await installHostStorage();
  alarmsCreateMock.mockClear();
  alarmsClearMock.mockClear();
  alarmsGetAllMock.mockReset();
  alarmsGetAllMock.mockResolvedValue([]);
  recordLogMock.mockClear();
  recordRefreshErrorMock.mockClear();
  clearWorkflowRunCacheMock.mockClear();
  clearWorkflowRunCacheForEnvironmentMock.mockClear();
  markWorkflowDefinitionallyStaleMock.mockClear();
  markRunDefinitionallyStaleMock.mockClear();
  storeState = {
    workflows: [],
    variables: [],
    requests: new Map(),
    caches: [],
    environments: [],
    vault: EMPTY_VAULT,
    workspaceVars: EMPTY_WORKSPACE_VARS,
    requestCollections: [],
    requestStoreHydrated: false,
    listeners: {
      workflow: new Set(),
      variable: new Set(),
      cache: new Set(),
      request: new Set(),
      environment: new Set(),
    },
  };
  activeSwitchState.workspaceListeners.clear();
  activeSwitchState.envListeners.clear();
  activeSwitchState.activeEnvId = null;
  ACTIVE_WORKSPACE_ID = 'ws-live';
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

  it('false when a step references a request that was deleted', () => {
    storeState.requestStoreHydrated = true;
    // `reqfetch1` deliberately not seeded — the backing request is gone.
    expect(scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(false);
  });

  it('true when every step still resolves to an existing request', () => {
    storeState.requestStoreHydrated = true;
    storeState.requests.set('reqfetch1', makeRequest());
    expect(scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(true);
  });

  it('skips the request-resolution check while the request store is cold', () => {
    // Not hydrated + `reqfetch1` unseeded — a cold-wake window must not
    // strip the alarm; the resolution gate stays dormant until hydrate.
    storeState.requestStoreHydrated = false;
    expect(scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(true);
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
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
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
    // Two subscribers per shared store now: the scheduler's own
    // reconcile + status listener, and the lifted definitional-freshness
    // module (LF1–LF4), which owns its own subscriptions.
    expect(storeState.listeners.workflow.size).toBe(2);
    expect(storeState.listeners.variable.size).toBe(2);
    expect(storeState.listeners.cache.size).toBe(2);
    expect(storeState.listeners.request.size).toBe(2);

    alarmsCreateMock.mockClear();
    // Simulate a workflow-store mutation.
    for (const fn of storeState.listeners.workflow) fn();
    // Reconcile is async (fire-and-forget); wait a microtask.
    await new Promise((r) => setTimeout(r, 0));
    expect(alarmsCreateMock).toHaveBeenCalled();
  });

  it('reconciles when a request-store mutation reshapes the dependency DAG', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    scheduler.startLiveScheduler();
    expect(storeState.listeners.request.size).toBe(2);

    alarmsCreateMock.mockClear();
    // Simulate a request edit (e.g. a `{{live.X}}` ref added/removed).
    for (const fn of storeState.listeners.request) fn();
    await new Promise((r) => setTimeout(r, 0));
    expect(alarmsCreateMock).toHaveBeenCalled();
  });

  it('stopLiveScheduler tears down every listener', () => {
    scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(2);
    scheduler.stopLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(0);
    expect(storeState.listeners.variable.size).toBe(0);
    expect(storeState.listeners.cache.size).toBe(0);
    expect(storeState.listeners.request.size).toBe(0);
  });

  it('is idempotent — a second start call does not double-subscribe', () => {
    scheduler.startLiveScheduler();
    scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(2);
  });

  it('subscribes to active-workspace + active-env switch events', () => {
    scheduler.startLiveScheduler();
    // Two workspace subscribers: the scheduler's switch-warm pass + the
    // freshness module's deferred-cascade drain. Only the scheduler
    // watches active-env switches.
    expect(activeSwitchState.workspaceListeners.size).toBe(2);
    expect(activeSwitchState.envListeners.size).toBe(1);
    scheduler.stopLiveScheduler();
    expect(activeSwitchState.workspaceListeners.size).toBe(0);
    expect(activeSwitchState.envListeners.size).toBe(0);
  });
});

// ── Definitional freshness — material request-edit refresh ────────

describe('material request-edit refresh', () => {
  /** Start the scheduler with a workflow embedding `reqfetch1`, then
   *  fire one request-store event to prime the fingerprint baseline. */
  async function startPrimed(workflow = makeWorkflow()): Promise<void> {
    scheduler.__setRequestEditRefreshDebounceMs(0);
    storeState.requests.set('reqfetch1', makeRequest());
    storeState.workflows = [workflow];
    storeState.variables = [makeVariable()];
    scheduler.startLiveScheduler();
    // First request-store event = hydration broadcast — primes the
    // baseline, never triggers a refresh.
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();
  }

  it('flags every env row + refreshes the active env on a material edit', async () => {
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();
    expect(markWorkflowDefinitionallyStaleMock).not.toHaveBeenCalled();

    // Material edit — the request URL changed.
    storeState.requests.set('reqfetch1', makeRequest({ url: 'https://api.openheaders.io/token-v2' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    // Every env row flagged definitionally stale — the flag drives the
    // due-now alarm for the non-active envs. No bare cache clear.
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'ws-live');
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    // Active env refreshed immediately so it has no wrong-recipe window.
    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
  });

  it('flags a disabled non-manual workflow without refreshing it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed(makeWorkflow({ enabled: false }));

    storeState.requests.set('reqfetch1', makeRequest({ method: 'POST' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    // A disabled workflow can't run now — but the flag persists on its
    // cache rows so a re-enable refreshes them via the due-now path
    // instead of serving the wrong-recipe value out to natural expiry.
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'ws-live');
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
  });

  it('ignores a cosmetic edit (rename) — fingerprint unchanged', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed();

    storeState.requests.set('reqfetch1', makeRequest({ name: 'Renamed', description: 'docs' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('flags a manual-trigger workflow definitionally stale instead of auto-running it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed(makeWorkflow({ refresh: { kind: 'manual' } }));

    storeState.requests.set('reqfetch1', makeRequest({ method: 'POST' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    // Manual workflow: no auto-run, no env-row clear — but every env
    // cache row is flagged definitionally stale so the UI badges it.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'ws-live');
  });

  it('does not flag a manual workflow on a cosmetic edit', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed(makeWorkflow({ refresh: { kind: 'manual' } }));

    storeState.requests.set('reqfetch1', makeRequest({ name: 'Renamed' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).not.toHaveBeenCalled();
  });
});

// ── Variable-edit refresh (LF2) ───────────────────────────────────

describe('variable-edit refresh (LF2)', () => {
  type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };

  function makeEnvironment(uid: string, vars: Array<{ name: string; value: string }>): Environment {
    return {
      schemaVersion: 5,
      uid,
      name: uid,
      variables: vars.map((v, i) => ({ uid: `${uid}var${i}`, name: v.name, value: v.value, type: 'default' as const })),
    };
  }

  /** A request whose Authorization header carries `refValue`. */
  function requestRef(refValue: string): Request {
    return makeRequest({ headers: [{ uid: 'hdrauth01', key: 'Authorization', value: refValue, enabled: true }] });
  }

  /** Start the scheduler with a workflow embedding a request that
   *  resolves `refValue`, then fire one env-store event to prime the
   *  variable-surface fingerprint baseline. */
  async function startPrimed(refValue = '{{env.token}}', workflow = makeWorkflow()): Promise<void> {
    scheduler.__setVariableEditRefreshDebounceMs(0);
    storeState.requests.set('reqfetch1', requestRef(refValue));
    storeState.workflows = [workflow];
    storeState.variables = [makeVariable()];
    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-aaa' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    scheduler.startLiveScheduler();
    // First env-store event = hydration broadcast — primes the
    // baseline, never triggers a refresh.
    for (const fn of storeState.listeners.environment) fn();
    await flushAsync();
  }

  function fireEnvChange(): void {
    for (const fn of storeState.listeners.environment) fn();
  }

  it('refreshes the active env when one of its variables changes', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
    // env-dev's row is flagged definitionally stale (a failed refresh
    // leaves the flag for the due-now alarm to retry; a successful one
    // clears it) and is refreshed in place — never dropped.
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
  });

  it('flags a non-active env row when that env variable changes', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-prod';
    await startPrimed();

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    // env-dev is non-active — its row is flagged definitionally stale
    // (kept, not dropped) so the due-now alarm re-warms it.
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('flips every env row when an environment-independent vault secret changes', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.vault = {
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'secret', value: 'aaa' }],
    };
    await startPrimed('{{vault.secret}}');

    storeState.vault = {
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'secret', value: 'CHANGED' }],
    };
    fireEnvChange();
    await flushAsync();

    // A vault secret is environment-independent — every env row flips.
    // The active env (env-dev) is refreshed; all three rows (env-dev,
    // env-prod, "No environment") are flagged definitionally stale,
    // never dropped.
    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    const flaggedEnvs = markRunDefinitionallyStaleMock.mock.calls.map((c) => c[1]);
    expect(flaggedEnvs).toContain('env-dev');
    expect(flaggedEnvs).toContain('env-prod');
    expect(flaggedEnvs).toContain(null);
  });

  it('flags a manual workflow affected env rows instead of refreshing', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed('{{env.token}}', makeWorkflow({ refresh: { kind: 'manual' } }));

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    // Only env-dev's row carried the changed variable.
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
  });

  it('ignores an edit to a variable the workflow does not reference', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();

    storeState.environments = [
      makeEnvironment('env-dev', [
        { name: 'token', value: 'dev-aaa' },
        { name: 'unrelated', value: 'new' },
      ]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).not.toHaveBeenCalled();
  });

  it('does not trigger on a request edit that changes the variable ref set', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();
    clearWorkflowRunCacheForEnvironmentMock.mockClear();
    markRunDefinitionallyStaleMock.mockClear();

    // The request gains a NEW variable reference — `refsKey` shifts.
    // LF2 re-baselines silently; LF1's request-edit path owns this.
    storeState.requests.set('reqfetch1', requestRef('{{env.token}}{{env.added}}'));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).not.toHaveBeenCalled();
  });

  it('flags an ineffective non-manual workflow without refreshing it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    // A disabled workflow is not schedulable — but a variable edit must
    // still flag its row definitionally stale so the value re-warms on
    // re-enable rather than serving wrong-recipe until cadence expiry.
    await startPrimed('{{env.token}}', makeWorkflow({ enabled: false }));

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
  });
});

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
    scheduler.startLiveScheduler();
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
    scheduler.startLiveScheduler();
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimedRunnable(makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqfetch1')] }));

    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [step('stp00001', 'fetch', 'reqother1')] })];
    fireWorkflowChange();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflowAAA', 'ws-live');
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('detects a step added to the workflow', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', requestRef('reqB00001', '{{live.authToken}}'));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' })];
    scheduler.startLiveScheduler();
    const cache = makeCacheTable();

    // The very first broadcast — even with a high extractedAt — only primes.
    cache.bumpAndFire('wflowAAA', 'env-dev', 99);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('does not cascade to a workflow that does not consume the upstream live value', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
    activeSwitchState.activeEnvId = 'env-dev';
    // B's request embeds no `{{live.X}}` reference — no downstream edge.
    storeState.requests.set('reqA00001', makeRequest({ uid: 'reqA00001' }));
    storeState.requests.set('reqB00001', makeRequest({ uid: 'reqB00001' }));
    storeState.workflows = [
      makeWorkflow({ uid: 'wflowAAA', steps: [step('stpA0001', 'reqA00001')] }),
      makeWorkflow({ uid: 'wflowBBB', steps: [step('stpB0001', 'reqB00001')] }),
    ];
    storeState.variables = [makeVariable({ uid: 'lvauth01', name: 'authToken', workflowUid: 'wflowAAA' })];
    scheduler.startLiveScheduler();
    const cache = makeCacheTable();
    cache.bumpAndFire('wflowAAA', 'env-dev', 1);
    await flushAsync();

    cache.bumpAndFire('wflowAAA', 'env-dev', 2);
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('walks a chain hop-by-hop — refreshing B then cascading to C', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
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
    scheduler.startLiveScheduler();
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
    ACTIVE_WORKSPACE_ID = wsId;
    for (const fn of activeSwitchState.workspaceListeners) fn(wsId, prev);
    for (const fn of storeState.listeners.request) fn();
    for (const fn of storeState.listeners.environment) fn();
    for (const fn of storeState.listeners.workflow) fn();
  }

  it('recovers a request edit made while another workspace was active (LF1)', async () => {
    scheduler.__setRequestEditRefreshDebounceMs(0);
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: vi.fn(async () => {}) });

    // Workspace A — workflow WA embeds request RA.
    storeState.requests = new Map([['reqAAAA1', makeRequest({ uid: 'reqAAAA1' })]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA', 'reqAAAA1')] })];
    storeState.variables = [makeVariable({ uid: 'lvAAAA1', workflowUid: 'wflowAAA' })];
    scheduler.startLiveScheduler();
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
    scheduler.__setVariableEditRefreshDebounceMs(0);
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: vi.fn(async () => {}) });
    activeSwitchState.activeEnvId = 'env-a';

    // Workspace A — WA's request resolves `{{env.token}}` in env-a.
    storeState.requests = new Map([['reqAAAA1', requestRef('reqAAAA1', '{{env.token}}')]]);
    storeState.workflows = [makeWorkflow({ uid: 'wflowAAA', steps: [wfStep('stpA', 'reqAAAA1')] })];
    storeState.variables = [makeVariable({ uid: 'lvAAAA1', workflowUid: 'wflowAAA' })];
    storeState.environments = [makeEnvironment('env-a', [{ name: 'token', value: 'v1' }])];
    scheduler.startLiveScheduler();
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
    scheduler.__setLiveCascadeRefreshDebounceMs(0);
    scheduler.__setLiveRefreshAdapter({ refreshWorkflow: vi.fn(async () => {}) });
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
    scheduler.startLiveScheduler();

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
    ACTIVE_WORKSPACE_ID = 'ws-b';
    for (const fn of activeSwitchState.workspaceListeners) fn('ws-b', 'ws-live');
    await flushAsync();
    // The settle fired while ws-b was active — it found ws-b's bucket
    // empty and left ws-live's bucket intact, so nothing was flagged.
    expect(markRunDefinitionallyStaleMock).not.toHaveBeenCalled();

    // Switch back — the workspace-switch hook drains ws-live's bucket.
    ACTIVE_WORKSPACE_ID = 'ws-live';
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
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
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
