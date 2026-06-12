/**
 * Desktop live-workflow refresh scheduler (WS-C C3).
 *
 * The main-process counterpart to the extension's alarm-driven live
 * scheduler: a thin provider over the SAME host-neutral
 * `RefreshScheduler` core (`@openheaders/oracle/scheduling`) the
 * extension's live + OAuth schedulers run on. Because the desktop
 * process is always-on, its timer substrate is the in-memory
 * `setTimeout` adapter (`createInMemoryRefreshTimer`) — no alarm-name
 * persistence, no reconcile-on-wake or SW-eviction recovery; that
 * ceremony is the `chrome.alarms` adapter's, on the extension host.
 *
 *   - cadence + backoff come from `@openheaders/core/live`
 *     (`computeNextFireAt`), the same math the browser uses;
 *   - the dispatch-time circuit semantics (`gateCircuitForFire` —
 *     attempt gate + open→half-open probe-start) are the same
 *     host-neutral live-cache machinery the extension provider runs;
 *   - each fire runs the chain via `./chain-runner`, which reuses the
 *     C1 lifted resolve→execute core over the Node transport;
 *   - reconciliation is driven reactively off the host-neutral oracle
 *     store-change events (workflow / variable / cache / environment /
 *     request / workspace), debounced in the core to collapse bursts;
 *   - the cross-workflow dependency graph depth-orders same-wave fires
 *     (downstream after upstream), exactly like the extension.
 *
 * The definitional-freshness suite (LF1–LF4 immediate refresh-on-edit +
 * the chained-workflow cascade) is host-neutral in
 * `@openheaders/oracle/live/definitional-freshness` and wired here via
 * the `refreshNow` seam — the core's gated `handleFire`: now that the
 * desktop is a value PRODUCER for deferring peers (C6+), a request /
 * variable / definition / upstream edit must re-mint this host's value
 * immediately rather than propagating a wrong-recipe token until the
 * next cadence tick.
 *
 * Active-workspace-only, exactly like the extension: only the workspace
 * the user is currently using has live timers. A workspace switch
 * re-hydrates the oracle stores, which fans the store-change events that
 * drive `reconcile`, so the timer set follows the active workspace
 * without a dedicated active-pointer subscription.
 */

import { type CacheSummary, computeNextFireAt, initialCircuitSnapshot } from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { getActiveEnvironmentId, onEnvironmentStoreChange } from '@openheaders/oracle/entity/environment-store';
import { onRequestStoreChange } from '@openheaders/oracle/entity/request-store';
import { startDefinitionalFreshness, stopDefinitionalFreshness } from '@openheaders/oracle/live/definitional-freshness';
import { gateCircuitForFire } from '@openheaders/oracle/live/fire-circuit-gate';
import {
  listCachesForWorkflow,
  onLiveCacheStoreChange,
  type WorkflowRunCache,
} from '@openheaders/oracle/live/live-cache-store';
import {
  getLiveVariablesForWorkflow,
  getLiveVariablesForWorkflowInWorkspace,
  onLiveVariableStoreChange,
} from '@openheaders/oracle/live/live-variable-store';
import {
  getLiveWorkflowInWorkspace,
  getLiveWorkflows,
  onLiveWorkflowStoreChange,
} from '@openheaders/oracle/live/live-workflow-store';
import { canScheduleWorkflow } from '@openheaders/oracle/live/scheduling-gate';
import { computeWorkflowDependencies } from '@openheaders/oracle/live/workflow-dependency-graph';
import {
  createInMemoryRefreshTimer,
  createKeyCodec,
  type RefreshProvider,
  RefreshScheduler,
} from '@openheaders/oracle/scheduling';
import { getActiveWorkspaceId, onWorkspaceStoreChange } from '@openheaders/oracle/workspace/extension-workspace-store';
import { runDesktopWorkflowRefresh } from './chain-runner';
import { recomputeDesktopLiveStatus } from './live-status';

const LOG = 'DesktopLiveRunner';

/** Collapse a burst of store-change events into one reconcile pass. */
const RECONCILE_DEBOUNCE_MS = 50;

const LIVE_KEY_PREFIX = 'live-refresh:';

interface LiveKeyPayload {
  /** workspaceId */
  w: string;
  /** workflowUid */
  u: string;
  /** environmentId — null = "No environment" */
  e: string | null;
}

const codec = createKeyCodec<LiveKeyPayload>(LIVE_KEY_PREFIX, (p): p is LiveKeyPayload => {
  if (!p || typeof p !== 'object') return false;
  const obj = p as { w?: unknown; u?: unknown; e?: unknown };
  if (typeof obj.w !== 'string' || typeof obj.u !== 'string') return false;
  return obj.e === null || typeof obj.e === 'string';
});

/** One schedulable refresh — a workflow paired with one env + that env's
 *  cache row (if any). */
interface LiveEntry {
  workspaceId: string;
  workflow: LiveWorkflow;
  boundVariables: LiveVariable[];
  cache: WorkflowRunCache | null;
  environmentId: string | null;
}

// ── Cache projection ──────────────────────────────────────────────
//
// The schedulability gate (`canScheduleWorkflow`) is host-neutral and
// shared with the extension scheduler via
// `@openheaders/oracle/live/scheduling-gate`.

/** Project a cache row down to the `CacheSummary` the cadence math reads. */
function toCacheSummary(run: WorkflowRunCache | null): CacheSummary | null {
  if (!run) return null;
  return {
    extractedAt: run.extractedAt || undefined,
    stepCaptures: run.stepCaptures,
    consecutiveFailures: run.consecutiveFailures,
    lastErrorAt: run.lastErrorAt,
    circuit: run.circuit ?? initialCircuitSnapshot(),
    definitionallyStale: run.definitionallyStale,
  };
}

/** Best-effort active environment for seeding a never-cached workflow's
 *  first warm. Falls back to "No environment" if unreadable. */
function seedEnvironmentId(): string | null {
  try {
    return getActiveEnvironmentId() ?? null;
  } catch {
    return null;
  }
}

/** Expand the active workspace's workflows into one entry per cached env
 *  (or a single seed-env entry for a workflow that has never refreshed). */
async function collectEntries(): Promise<LiveEntry[]> {
  const activeId = getActiveWorkspaceId();
  if (!activeId) return [];
  const workflows = getLiveWorkflows();
  if (workflows.length === 0) return [];

  const seedEnv = seedEnvironmentId();
  const out: LiveEntry[] = [];
  for (const workflow of workflows) {
    const runs = await listCachesForWorkflow(workflow.uid, activeId);
    const envs: Array<string | null> = runs.length > 0 ? runs.map((r) => r.environmentId) : [seedEnv];
    const boundVariables = getLiveVariablesForWorkflow(workflow.uid);
    for (const environmentId of envs) {
      out.push({
        workspaceId: activeId,
        workflow,
        boundVariables,
        cache: runs.find((r) => r.environmentId === environmentId) ?? null,
        environmentId,
      });
    }
  }
  return out;
}

// ── Provider — fills in the desktop-specific bits ─────────────────

/**
 * Sentinel thrown when `gateCircuitForFire` refuses a dispatch (OPEN
 * circuit before `nextAttemptAt` — timers can wake early, racing
 * reconciles can arm inside the backoff window). Not a failure — the
 * state machine is doing its job; `recordFailure` returns the row
 * untouched and the core's post-fire re-arm lines the next attempt up
 * with `nextAttemptAt`. A class (not a string match) so `onFailed`'s
 * level routing stays exhaustive.
 */
class CircuitBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBlocked';
  }
}

const provider: RefreshProvider<LiveKeyPayload, LiveEntry, WorkflowRunCache | null> = {
  keyPrefix: LIVE_KEY_PREFIX,
  decodeKey: (key) => codec.decode(key),
  encodeKey: (entry) => codec.encode({ w: entry.workspaceId, u: entry.workflow.uid, e: entry.environmentId }),
  encodeKeyFromPayload: (payload) => codec.encode(payload),
  listAll: () => collectEntries(),
  async getByKey(payload) {
    const workflow = getLiveWorkflowInWorkspace(payload.u, payload.w);
    if (!workflow) return null;
    const boundVariables = getLiveVariablesForWorkflowInWorkspace(payload.u, payload.w);
    const runs = await listCachesForWorkflow(payload.u, payload.w);
    const cache = runs.find((r) => r.environmentId === payload.e) ?? null;
    return {
      workspaceId: payload.w,
      workflow,
      boundVariables,
      cache,
      environmentId: payload.e,
    };
  },
  computeNextFireAt: (entry, nowMs) => computeNextFireAt(entry.workflow, toCacheSummary(entry.cache), nowMs),
  canSchedule: (entry) => canScheduleWorkflow(entry.workflow, entry.boundVariables),
  computeDependencies: (entries) => computeWorkflowDependencies(entries, (w, u, e) => codec.encode({ w, u, e })),
  async refresh(entry, payload) {
    const now = Date.now();
    const circuitOk = await gateCircuitForFire({
      circuit: entry.cache?.circuit ?? null,
      workflowUid: payload.u,
      environmentId: payload.e,
      workspaceId: payload.w,
      nowMs: now,
    });
    if (!circuitOk) {
      throw new CircuitBlockedError(`circuit-blocked: workflow ${payload.u}`);
    }
    // The runner owns the cache write (success → captures; failure →
    // recorded error) and only throws on an unexpected fault. A
    // per-fire success log would be pure noise on an always-on host,
    // so `onSucceeded` below is silent.
    await runDesktopWorkflowRefresh({
      workspaceId: entry.workspaceId,
      workflow: entry.workflow,
      environmentId: entry.environmentId,
    });
  },
  async recordFailure(_payload, _err, job) {
    // No defensive cache write: an ordinary refresh failure is recorded
    // by the runner itself (with the failed step id), and a
    // circuit-blocked skip deliberately wrote nothing. Return the
    // current row so `onFailed` has context; the core's post-fire
    // re-arm targets the backoff window either way.
    return job?.cache ?? null;
  },
  onStoreChange(callback) {
    // Every store mutation drives two things: the core's (debounced)
    // reconcile and the live Status pill recompute — the same
    // one-listener-per-store fold the extension provider uses. The
    // pill is a pure function of the active-workspace cache rows,
    // which change on exactly these events (a fire's cache write, a
    // delete, a workspace switch's re-hydration).
    const combined = (): void => {
      callback();
      scheduleStatusRecompute();
    };
    const unsubscribers: Array<() => void> = [
      onLiveWorkflowStoreChange(combined),
      onLiveVariableStoreChange(combined),
      onLiveCacheStoreChange(() => combined()),
      onEnvironmentStoreChange(combined),
      onRequestStoreChange(combined),
      onWorkspaceStoreChange(combined),
    ];
    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  },
  onFired() {
    // Per-fire logging is noise on an always-on host; failures speak.
  },
  onSucceeded() {},
  onFailed(payload, err) {
    if (err instanceof CircuitBlockedError) {
      logger.debug(LOG, `Circuit open for ${payload.u} — refresh declined`);
      return;
    }
    // An unexpected store/engine fault (an ordinary refresh failure is
    // recorded by the runner, not thrown). The core keeps the timer
    // loop alive — log and let the post-fire re-arm carry on.
    logger.warn(LOG, `Unexpected refresh fault for ${payload.u}: ${err.message}`);
  },
};

// ── Scheduler + timer wiring ──────────────────────────────────────

const timer = createInMemoryRefreshTimer((key) => {
  void scheduler.handleFire(key);
});
const scheduler = new RefreshScheduler(provider, LOG, timer, { reconcileDebounceMs: RECONCILE_DEBOUNCE_MS });

// ── Status recompute ──────────────────────────────────────────────
//
// Debounced on the same window as the reconcile pass so a burst of
// store-change events recomputes the pill once.

let statusTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleStatusRecompute(): void {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusTimer = null;
    void recomputeDesktopLiveStatus().catch((e) =>
      logger.warn(LOG, `live status recompute failed: ${(e as Error).message}`),
    );
  }, RECONCILE_DEBOUNCE_MS);
}

// ── Lifecycle ─────────────────────────────────────────────────────

let started = false;

/**
 * Start the desktop live runner. Subscribes to the host-neutral store
 * events that drive reconciliation and primes one reconcile from the
 * already-hydrated stores. Idempotent — a second call is a no-op.
 */
export function startDesktopLiveRunner(): void {
  if (started) return;
  started = true;
  scheduler.start();
  // The host-neutral definitional-freshness detectors (LF1–LF4) own
  // their own store subscriptions; the only host-specific seam is
  // `refreshNow` — the core's gated `handleFire`, so an edit-triggered
  // active-env refresh carries the same circuit handling + cache-write
  // discipline as a cadence fire. Now that the desktop is a value
  // PRODUCER for deferring peers (C6+), it must self-correct a
  // wrong-recipe value on edit rather than propagating it until the
  // next cadence tick.
  startDefinitionalFreshness({
    refreshNow: (workspaceId, workflowUid, environmentId) =>
      scheduler.handleFire(codec.encode({ w: workspaceId, u: workflowUid, e: environmentId })),
  });
  void scheduler
    .reconcile()
    .then(() => recomputeDesktopLiveStatus())
    .catch((e) => logger.warn(LOG, `initial reconcile failed: ${(e as Error).message}`));
}

/** Tear down all timers + subscriptions (called on `before-quit`). */
export function stopDesktopLiveRunner(): void {
  if (!started) return;
  started = false;
  stopDefinitionalFreshness();
  scheduler.stop();
  timer.clearAll();
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
}
