/**
 * Shared test harness for the `live-refresh-scheduler` suite.
 *
 * The scheduler is large enough that its tests are split by theme into
 * sibling `*.test.ts` files (codec/schedule, reconcile/dispatch,
 * definitional-freshness, workspace-switch, network/timezone, cadence-
 * ownership). They all need the identical mock graph — `chrome.alarms`,
 * the live stores, `observability-log`, the policy assembler — so it
 * lives here once.
 *
 * Each test file does `import * as H from './_harness'`. The static
 * import is what registers the `vi.mock` calls + the `beforeEach` /
 * `afterEach` hooks against that file (Vitest hoists both across the
 * imported module graph). Consumers destructure the stable exports
 * (mock fns, fixtures, `storeState`) and reach the freshly re-imported
 * module via `H.scheduler` — a live binding reassigned every
 * `beforeEach`, so it must NOT be destructured.
 */

import type {
  Collection,
  Environment,
  LiveVariable,
  LiveWorkflow,
  Request,
  Vault,
  WorkflowRunCache,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { afterEach, beforeEach, vi } from 'vitest';

// ── Global mocks ──────────────────────────────────────────────────

export const alarmsCreateMock = vi.fn<(name: string, info: chrome.alarms.AlarmCreateInfo) => void>();
export const alarmsClearMock = vi.fn<(name: string) => void>();
export const alarmsGetAllMock = vi.fn<() => Promise<chrome.alarms.Alarm[]>>();
export const recordLogMock = vi.fn();
export const recordRefreshErrorMock = vi.fn();
export const markExclusiveDegradedForRunMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);
export const deriveExecutionPolicyForWorkflowMock = vi.fn<
  () => { policy: 'idempotent' | 'exclusive'; reasons: unknown[] }
>(() => ({ policy: 'idempotent', reasons: [] }));
export const isFallbackEligibleForWorkflowMock = vi.fn<() => boolean>(() => true);
export const clearWorkflowRunCacheMock = vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0);
export const clearWorkflowRunCacheForEnvironmentMock = vi.fn<(...args: unknown[]) => Promise<boolean>>(
  async () => true,
);
export const markWorkflowDefinitionallyStaleMock = vi.fn<(...args: unknown[]) => Promise<number>>(async () => 0);
export const markRunDefinitionallyStaleMock = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);

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
export interface TestCacheRow {
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
  definitionallyStale?: boolean;
  lastSyncedValueAt?: number;
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

export const EMPTY_VAULT: Vault = { schemaVersion: 5, secrets: [] };
export const EMPTY_WORKSPACE_VARS: WorkspaceVariables = { schemaVersion: 5, variables: [] };

interface StoreState {
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
}

function freshStoreState(): StoreState {
  return {
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
}

// Stable container — `beforeEach` resets its FIELDS (not the reference)
// so test files can destructure `storeState` from the harness and still
// observe the per-test reset.
export const storeState: StoreState = freshStoreState();

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
  markExclusiveDegradedForRun: (...args: unknown[]) => markExclusiveDegradedForRunMock(...args),
}));

// Isolate the scheduler's C9 escape-hatch branch from the policy
// assembler — the assembler's store-reading is covered by its own test;
// here we drive the policy verdict directly. Default idempotent so every
// pre-C9 test (and the C8 idempotent escape hatch) behaves unchanged.
vi.mock('@openheaders/oracle/live/execution-policy-resolver', () => ({
  deriveExecutionPolicyForWorkflow: (...args: unknown[]) =>
    (deriveExecutionPolicyForWorkflowMock as unknown as (...a: unknown[]) => unknown)(...args),
  isFallbackEligibleForWorkflow: (...args: unknown[]) =>
    (isFallbackEligibleForWorkflowMock as unknown as (...a: unknown[]) => unknown)(...args),
}));

// Active-pointer change listeners — the scheduler subscribes to these
// on `startLiveScheduler` so a workspace/env switch automatically
// triggers `kickActiveContextRefresh`. The mocks expose the listener
// sets so tests can fire synthetic switches and verify reactivity.
export const activeSwitchState = {
  workspaceListeners: new Set<(newId: string, prevId: string | null) => void>(),
  envListeners: new Set<(newId: string | null, prevId: string | null) => void>(),
  activeEnvId: null as string | null,
};

// Mutable holder for the active workspace id — cross-workspace cases set
// `activeWorkspace.id` to simulate a switch (a re-exported `let` can't be
// reassigned from an importer, so a holder object is used). Most tests
// leave it at the default `'ws-live'`.
export const activeWorkspace = { id: 'ws-live' };

// Both the shim (`@/background/modules/workspace-store`, what the
// scheduler imports) and the canonical path (what the lifted
// definitional-freshness module imports) resolve to the same accessors;
// mock both against the one `activeSwitchState` closure so a workspace
// subscription from either side lands in the same set.
function workspaceStoreMock() {
  return {
    // The scheduler reads the active workspace synchronously from this
    // sync accessor when an env-switch event fires (workspace doesn't
    // change on env-switch but the listener doesn't carry it). Tests
    // that don't assert env-switch behavior don't need to override.
    getActiveWorkspaceId: () => activeWorkspace.id,
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
import {
  installBackingStorage,
  installHostStorage,
  seedStorageMany as seedStorageManyImpl,
} from '../../helpers/chrome-storage-backing';

/** Re-exported as a plain const so it lands in the `* as H` namespace. */
export const seedStorageMany = seedStorageManyImpl;

// ── Fixtures ──────────────────────────────────────────────────────

export const NOW = 1_700_000_000_000;

export function makeWorkflow(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
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

export function makeVariable(overrides: Partial<LiveVariable> = {}): LiveVariable {
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

export function makeRequest(overrides: Partial<Request> = {}): Request {
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
export async function flushAsync(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
}

// ── Test harness lifecycle ────────────────────────────────────────

// The freshly re-imported scheduler module. Live binding — reassigned
// every `beforeEach`, so consumers MUST reach it as `H.scheduler`, never
// via destructuring.
export let scheduler: typeof import('@/background/modules/live-refresh-scheduler');

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
  markExclusiveDegradedForRunMock.mockClear();
  deriveExecutionPolicyForWorkflowMock.mockReset();
  deriveExecutionPolicyForWorkflowMock.mockReturnValue({ policy: 'idempotent', reasons: [] });
  isFallbackEligibleForWorkflowMock.mockReset();
  isFallbackEligibleForWorkflowMock.mockReturnValue(true);
  Object.assign(storeState, freshStoreState());
  activeSwitchState.workspaceListeners.clear();
  activeSwitchState.envListeners.clear();
  activeSwitchState.activeEnvId = null;
  activeWorkspace.id = 'ws-live';
  // Seed an active workspace so `collectEntries` can route the
  // in-memory path.
  seedStorageMany({
    'oh.workspaces': [{ id: 'ws-live', name: 'Live', color: '#000', iconMode: 'emoji' }],
    'oh.runtimeActive.active': 'ws-live',
  });
  scheduler = await import('@/background/modules/live-refresh-scheduler');
  scheduler.__setLiveRefreshAdapter(null);
  scheduler.setBackendConnectionProbe(null);
  scheduler.setFallbackPriorityProbe(null);
});

afterEach(() => {
  scheduler.stopLiveScheduler();
});
