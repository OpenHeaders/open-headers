/**
 * Live workflow refresh scheduler — alarm-driven background refresh so
 * `{{live.X}}` values stay warm without requiring a renderer-side
 * refresh click.
 *
 * ARCHITECTURE §20 + `docs/LIVE_VARIABLES_PLAN.md` (Phase C).
 *
 * Implementation: thin provider over the shared `RefreshScheduler`
 * (`./refresh-scheduler`). Live owns the cadence math (delegated to
 * `@openheaders/core/live/refresh-cadence`), the gate (`canScheduleWorkflow`
 * — enabled + ≥1 enabled LV bound), the per-env alarm expansion (one
 * alarm per `(workflow, env)` because each env has its own cache row),
 * and the refresh delegation (to `live-chain-adapter` via the adapter
 * port). Everything else — alarm-name codec, reconcile-on-wake, orphan
 * sweep, store-change subscription, handleAlarm dispatch — is shared
 * with the OAuth scheduler through the generic `RefreshScheduler`.
 *
 * What is NOT scheduled:
 *   • Workflows with `refresh.kind === 'manual'` — user-triggered only.
 *     `computeNextFireAt` returns null → scheduler declines.
 *   • Workflows that are `enabled: false` or whose bound LVs are all
 *     disabled — `canScheduleWorkflow` → false.
 *
 * Cadence:
 *   • Healthy path: `computeNextFireAt(workflow, cache, now)` from
 *     `@openheaders/core/live/refresh-cadence`. Respects the 30s MV3
 *     floor + `expires-in` / `expires-at` lead time.
 *   • After a failure: the SAME core function applies the `60·2^(n-1)`
 *     backoff (capped at 3600s) off `cache.lastErrorAt`. We don't
 *     duplicate the math here.
 *
 * Observability: every fired alarm writes one structured entry to the
 * observability log (`subsystem: 'live'`). Values never appear —
 * entries carry `{workflowUid, op, workspaceId, environmentId?}` only.
 *
 * Status pill: `recomputeLiveStatus()` aggregates every workspace's
 * cached runs into one `live` Status entry after every tick (see
 * Phase G).
 */

import {
  type CacheSummary,
  computeNextFireAt as computeNextFireAtCore,
  MAX_BACKOFF_SECONDS,
  MIN_ALARM_DELAY_MS,
} from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { report as reportStatus } from '@/shared/status';
import { extensionStorage, OH, wsKeys } from '@/shared/storage';
import {
  listCachesForWorkflow,
  listWorkflowRunCaches,
  onLiveCacheStoreChange,
  recordRefreshError,
  type WorkflowRunCache,
} from './live-cache-store';
import { getLiveVariablesForWorkflow, onLiveVariableStoreChange } from './live-variable-store';
import { getLiveWorkflows, onLiveWorkflowStoreChange } from './live-workflow-store';
import { recordLog } from './observability-log';
import { createAlarmNameCodec, type RefreshProvider, RefreshScheduler } from './refresh-scheduler';

// ── Constants ──────────────────────────────────────────────────────

export const LIVE_ALARM_PREFIX = 'live-refresh:';

// Re-exported from core so the scheduler can be reasoned about in
// isolation, and so tests don't have to reach across package bounds
// to pin the floor value.
export { MAX_BACKOFF_SECONDS, MIN_ALARM_DELAY_MS };

// ── Alarm name codec (shared primitive) ───────────────────────────

interface LiveAlarmPayload {
  /** workspaceId */
  w: string;
  /** workflowUid */
  u: string;
  /** environmentId — null = "No environment" */
  e: string | null;
}

const codec = createAlarmNameCodec<LiveAlarmPayload>(LIVE_ALARM_PREFIX, (p): p is LiveAlarmPayload => {
  if (!p || typeof p !== 'object') return false;
  const obj = p as { w?: unknown; u?: unknown; e?: unknown };
  if (typeof obj.w !== 'string' || typeof obj.u !== 'string') return false;
  return obj.e === null || typeof obj.e === 'string';
});

/**
 * Encode `(workspaceId, workflowUid, environmentId)` into an alarm
 * name. Uses base64url over JSON so arbitrary id contents survive.
 * `environmentId === null` round-trips to the "No environment" state.
 */
export function buildAlarmName(workspaceId: string, workflowUid: string, environmentId: string | null): string {
  return codec.encode({ w: workspaceId, u: workflowUid, e: environmentId });
}

/**
 * Decode an alarm name produced by {@link buildAlarmName}. Returns
 * null for anything that doesn't carry the prefix or whose payload is
 * malformed.
 */
export function parseAlarmName(
  name: string,
): { workspaceId: string; workflowUid: string; environmentId: string | null } | null {
  const parsed = codec.decode(name);
  if (!parsed) return null;
  return { workspaceId: parsed.w, workflowUid: parsed.u, environmentId: parsed.e };
}

/** True when the alarm belongs to the live scheduler. */
export function isLiveRefreshAlarm(alarm: chrome.alarms.Alarm): boolean {
  return codec.matches(alarm?.name);
}

// ── Refresh adapter port (Phase D fills this in) ──────────────────

export interface LiveRefreshAdapter {
  /**
   * Execute a workflow's chain of steps against the given env and
   * write the result to the cache (either `putWorkflowRunCache` on
   * success or `recordRefreshError` on failure). Thrown errors are
   * still caught by the scheduler and folded into `recordRefreshError`,
   * but well-behaved adapters handle the cache write themselves so
   * they can carry richer context (failed step id, extractor fault).
   */
  refreshWorkflow(args: {
    workspaceId: string;
    workflow: V5.LiveWorkflow;
    environmentId: string | null;
  }): Promise<void>;
}

let refreshAdapter: LiveRefreshAdapter | null = null;

/**
 * Install or clear the refresh adapter. Phase D's `live-chain-adapter`
 * calls this at module-load; tests may install a mock. Passing `null`
 * forces the "scheduler-not-ready" error path.
 */
export function __setLiveRefreshAdapter(adapter: LiveRefreshAdapter | null): void {
  refreshAdapter = adapter;
}

// ── Can-refresh gate + cache summary ──────────────────────────────

/**
 * Decide whether a workflow should have an alarm at all. A workflow
 * is schedulable when it's enabled, has manual bindings that want
 * fresh values, and has at least one enabled LV pointing at it (the
 * v1 reference-count heuristic). Returns `true` even for `manual`
 * refresh policies — `computeNextFireAt` declines a fire in that case
 * but we still want `scheduleLiveWorkflowRefresh` to clear a stale
 * alarm through `cancelLiveWorkflowRefresh`.
 */
export function canScheduleWorkflow(workflow: V5.LiveWorkflow, boundVariables: V5.LiveVariable[]): boolean {
  if (!workflow.enabled) return false;
  const hasEnabledBinding = boundVariables.some((v) => v.enabled);
  if (!hasEnabledBinding) return false;
  return true;
}

/**
 * Project a `WorkflowRunCache` down to the `CacheSummary` the core
 * cadence function needs. Pure mapping — lets the scheduler stay
 * dependency-light at its boundary with the core module.
 */
export function toCacheSummary(run: WorkflowRunCache | null | undefined): CacheSummary | null {
  if (!run) return null;
  return {
    extractedAt: run.extractedAt || undefined,
    stepCaptures: run.stepCaptures,
    consecutiveFailures: run.consecutiveFailures,
    lastErrorAt: run.lastErrorAt,
  };
}

// ── Job shape — one alarm per (workspace, workflow, env) ──────────

/**
 * One scheduleable refresh — a workflow paired with a specific env
 * and the cache row for that env (if any). The scheduler dispatches
 * one alarm per entry; `listAll` expands each workflow into N entries
 * across its cached envs (or a single `null`-env entry when the
 * workflow has never refreshed).
 */
interface LiveEntry {
  workspaceId: string;
  workflow: V5.LiveWorkflow;
  boundVariables: V5.LiveVariable[];
  cache: WorkflowRunCache | null;
  environmentId: string | null;
}

// ── Reconcile data collection ─────────────────────────────────────

async function collectEntries(): Promise<LiveEntry[]> {
  const out: LiveEntry[] = [];

  // ── Active workspace (in-memory snapshot) ────────────────────
  const activeWorkflows = getLiveWorkflows();
  const activeId = (await extensionStorage.get(OH.activeWorkspaceId)) ?? '';
  if (activeWorkflows.length > 0 && typeof activeId === 'string' && activeId.length > 0) {
    for (const workflow of activeWorkflows) {
      const runs = await listCachesForWorkflow(workflow.uid, activeId);
      const envs: Array<string | null> = runs.length > 0 ? runs.map((r) => r.environmentId) : [null];
      const boundVariables = getLiveVariablesForWorkflow(workflow.uid);
      for (const envId of envs) {
        out.push({
          workspaceId: activeId,
          workflow,
          boundVariables,
          cache: runs.find((r) => r.environmentId === envId) ?? null,
          environmentId: envId,
        });
      }
    }
  }

  // ── Inactive workspaces (read directly from storage) ─────────
  const workspaces = (await extensionStorage.get(OH.workspaces)) ?? [];
  for (const ws of workspaces) {
    if (ws.id === activeId) continue; // already handled via in-memory path
    const stored = await readInactiveWorkspace(ws.id);
    for (const workflow of stored.workflows) {
      const runs = stored.runs.filter((r) => r.workflowUid === workflow.uid);
      const envs: Array<string | null> = runs.length > 0 ? runs.map((r) => r.environmentId) : [null];
      const boundVariables = stored.variables.filter((v) => v.workflowUid === workflow.uid);
      for (const envId of envs) {
        out.push({
          workspaceId: ws.id,
          workflow,
          boundVariables,
          cache: runs.find((r) => r.environmentId === envId) ?? null,
          environmentId: envId,
        });
      }
    }
  }

  return out;
}

async function readInactiveWorkspace(workspaceId: string): Promise<{
  workflows: V5.LiveWorkflow[];
  variables: V5.LiveVariable[];
  runs: WorkflowRunCache[];
}> {
  const k = wsKeys(workspaceId);
  const [workflows, variables, runs] = await Promise.all([
    extensionStorage.get(k.liveWorkflows),
    extensionStorage.get(k.liveVariables),
    listWorkflowRunCaches(workspaceId),
  ]);
  return {
    workflows: Array.isArray(workflows) ? workflows : [],
    variables: Array.isArray(variables) ? variables : [],
    runs,
  };
}

// ── Provider — fills in the subsystem-specific bits ───────────────

const provider: RefreshProvider<LiveAlarmPayload, LiveEntry, WorkflowRunCache> = {
  alarmPrefix: LIVE_ALARM_PREFIX,
  decodeAlarm: (name) => codec.decode(name),
  encodeAlarm: (entry) => codec.encode({ w: entry.workspaceId, u: entry.workflow.uid, e: entry.environmentId }),
  encodeAlarmFromPayload: (payload) => codec.encode(payload),
  listAll: () => collectEntries(),
  async getByAlarm(payload) {
    // Lookup: first try the active workspace's in-memory store, then
    // fall back to on-disk blobs for an inactive workspace. Mirrors
    // `collectEntries` so a single-alarm dispatch sees the same job
    // shape reconcile saw when scheduling.
    let workflow: V5.LiveWorkflow | undefined = getLiveWorkflows().find((w) => w.uid === payload.u);
    let boundVariables: V5.LiveVariable[] = [];
    let cache: WorkflowRunCache | null = null;
    if (workflow) {
      boundVariables = getLiveVariablesForWorkflow(payload.u);
      const runs = await listCachesForWorkflow(payload.u, payload.w);
      cache = runs.find((r) => r.environmentId === payload.e) ?? null;
    } else {
      const stored = await readInactiveWorkspace(payload.w);
      workflow = stored.workflows.find((w) => w.uid === payload.u);
      if (workflow) {
        boundVariables = stored.variables.filter((v) => v.workflowUid === payload.u);
        cache = stored.runs.find((r) => r.workflowUid === payload.u && r.environmentId === payload.e) ?? null;
      }
    }
    if (!workflow) return null;
    return {
      workspaceId: payload.w,
      workflow,
      boundVariables,
      cache,
      environmentId: payload.e,
    };
  },
  computeNextFireAt: (entry, nowMs) => computeNextFireAtCore(entry.workflow, toCacheSummary(entry.cache), nowMs),
  canSchedule: (entry) => canScheduleWorkflow(entry.workflow, entry.boundVariables),
  async refresh(entry, payload) {
    if (!refreshAdapter) {
      // Phase C shipped before Phase D. Record a scheduler-not-ready
      // error so the cache's failure counter widens and we don't
      // hot-loop. Throws so the scheduler routes into `onFailed`.
      throw new LiveSchedulerNotReadyError(
        `scheduler-not-ready: no refresh adapter installed for workflow ${payload.u}`,
      );
    }
    await refreshAdapter.refreshWorkflow({
      workspaceId: entry.workspaceId,
      workflow: entry.workflow,
      environmentId: entry.environmentId,
    });
  },
  async recordFailure(payload, err) {
    // `live-chain-adapter` records its own error with richer context
    // (failed step id, extractor phase) before throwing — this
    // defensive write covers the scheduler-not-ready path + any
    // unexpected bubble from a misbehaving adapter. The cache returns
    // the post-increment row, which the RefreshScheduler passes to
    // `onFailed` as the error-state snapshot.
    return recordRefreshError(
      {
        workflowUid: payload.u,
        environmentId: payload.e,
        message: err.message ?? 'refresh failed',
        extractorOk: false,
      },
      payload.w,
    );
  },
  onStoreChange(callback) {
    // Every live store mutation drives two things: (1) the scheduler's
    // reconcile (its `callback` argument), and (2) the `live` Status
    // pill recompute. Folding both into one listener per store keeps
    // the subscription count at exactly one per store — which is also
    // what the scheduler's unit tests assert.
    const combined = (): void => {
      callback();
      void recomputeLiveStatus().catch(() => {});
    };
    const unsubscribers: Array<() => void> = [
      onLiveWorkflowStoreChange(combined),
      onLiveVariableStoreChange(combined),
      onLiveCacheStoreChange(combined),
    ];
    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  },
  onFired(payload) {
    recordLog({
      subsystem: 'live',
      op: 'refresh-fired',
      level: 'info',
      message: `Alarm fired for workflow ${payload.u}`,
      context: { workspaceId: payload.w, workflowUid: payload.u, environmentId: payload.e },
    });
  },
  onSucceeded(payload) {
    recordLog({
      subsystem: 'live',
      op: 'refresh-succeeded',
      level: 'info',
      message: `Refreshed workflow ${payload.u}`,
      context: { workspaceId: payload.w, workflowUid: payload.u, environmentId: payload.e },
    });
  },
  onFailed(payload, err) {
    // Phase-C stub (scheduler-not-ready) gets a `warn`; a real
    // adapter bubble is `error`. Unlike OAuth we don't escalate per
    // attempt count — Phase G's Status pill already aggregates
    // consecutive failures into yellow/red, so per-entry log-level
    // churn would add noise without new signal.
    const isStub = err instanceof LiveSchedulerNotReadyError;
    recordLog({
      subsystem: 'live',
      op: 'refresh-failed',
      level: isStub ? 'warn' : 'error',
      message: isStub
        ? `No refresh adapter for workflow ${payload.u} (Phase D not yet wired)`
        : `Refresh failed for ${payload.u}: ${err.message}`,
      context: {
        workspaceId: payload.w,
        workflowUid: payload.u,
        environmentId: payload.e,
        errorClass: isStub ? 'SchedulerNotReady' : err.name,
      },
    });
  },
};

/**
 * Sentinel error the provider throws when the chain adapter hasn't
 * been registered yet (Phase C shipped before Phase D). Kept module-
 * local so `onFailed` can distinguish the stub path from real adapter
 * failures when routing log level.
 */
class LiveSchedulerNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerNotReady';
  }
}

const scheduler = new RefreshScheduler(provider, 'LiveScheduler');

// ── Public API (preserved for external callers + tests) ───────────

/**
 * Schedule (or re-schedule) the alarm for one workflow-run identity.
 * Safe to call repeatedly. Returns `true` when an alarm was scheduled,
 * `false` when the workflow was skipped (manual-only, cadence returned
 * null, no bindings, disabled, or alarms shim unavailable).
 */
export async function scheduleLiveWorkflowRefresh(
  entry: {
    workspaceId: string;
    workflow: V5.LiveWorkflow;
    boundVariables: V5.LiveVariable[];
    cache: WorkflowRunCache | null;
    environmentId: string | null;
  },
  nowMs: number = Date.now(),
): Promise<boolean> {
  return scheduler.schedule(entry, nowMs);
}

/** Cancel the alarm for one `(workflow, env)` pair. No-op when absent. */
export async function cancelLiveWorkflowRefresh(
  workspaceId: string,
  workflowUid: string,
  environmentId: string | null,
): Promise<void> {
  await scheduler.cancelByPayload({ w: workspaceId, u: workflowUid, e: environmentId });
}

/**
 * Walk every workspace's workflows and (re)schedule each eligible
 * one. Orphan alarms (workflows deleted or disabled since last
 * schedule) are cleared against `chrome.alarms.getAll()`.
 */
export async function reconcileLiveSchedules(nowMs: number = Date.now()): Promise<void> {
  return scheduler.reconcile(nowMs);
}

/**
 * Handle a `live-refresh:*` alarm. Delegates to the shared scheduler,
 * which decodes + loads + gates + delegates to the adapter + routes
 * observability + records failure.
 */
export async function handleLiveAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  return scheduler.handleAlarm(alarm);
}

// ── Status reporting ─────────────────────────────────────────────
//
// Single aggregation pass across every cached run for every workspace
// drives the `live` Status pill per the plan (§Observability → Status
// pill color rules):
//
//   green  — no cached runs with failures + no stale-beyond-2×-cadence
//            + lastExtractorOk on every run that has run at least once
//   yellow — any stale beyond 2× cadence OR lastExtractorOk=false OR
//            consecutiveFailures in 1..4
//   red    — any consecutiveFailures >= 5
//
// Values never appear in Status messages — only counts + the "first
// failing workflow" for a hint. Host-permission red (from §12) routes
// through the existing `permissions` pill; surfacing permissions state
// on the live pill would double-report and confuse the triage story.

const RED_FAILURE_THRESHOLD = 5;

async function recomputeLiveStatus(): Promise<void> {
  let runs: WorkflowRunCache[];
  try {
    runs = await listWorkflowRunCaches();
  } catch {
    // Storage read failure — leave the pill alone rather than flipping
    // to a misleading red. The scheduler still fires alarms; a real
    // failure surfaces on the next refresh dispatch.
    return;
  }
  if (runs.length === 0) {
    reportStatus({
      subsystem: 'live',
      state: 'green',
      message: 'No workflows configured',
    });
    return;
  }
  let red = 0;
  let yellow = 0;
  let firstRed: string | undefined;
  let firstYellow: string | undefined;
  const now = Date.now();
  for (const run of runs) {
    if (run.consecutiveFailures >= RED_FAILURE_THRESHOLD) {
      red++;
      firstRed ??= run.workflowUid;
      continue;
    }
    if (run.consecutiveFailures > 0 || !run.lastExtractorOk) {
      yellow++;
      firstYellow ??= run.workflowUid;
      continue;
    }
    if (run.expiresAt != null && run.extractedAt > 0) {
      const window = run.expiresAt - run.extractedAt;
      if (window > 0 && now - run.extractedAt > 2 * window) {
        yellow++;
        firstYellow ??= run.workflowUid;
      }
    }
  }
  if (red > 0) {
    reportStatus({
      subsystem: 'live',
      state: 'red',
      message: `${red} workflow${red === 1 ? '' : 's'} failing (${RED_FAILURE_THRESHOLD}+ consecutive)`,
      context: { red, yellow, firstRed },
    });
    return;
  }
  if (yellow > 0) {
    reportStatus({
      subsystem: 'live',
      state: 'yellow',
      message: `${yellow} workflow${yellow === 1 ? '' : 's'} stale or failing`,
      context: { yellow, firstYellow },
    });
    return;
  }
  reportStatus({
    subsystem: 'live',
    state: 'green',
    message: `${runs.length} workflow${runs.length === 1 ? '' : 's'} fresh`,
    context: { fresh: runs.length },
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────

/**
 * Wire the scheduler's store subscription. The shared scheduler's
 * `start()` installs ONE listener per store via the provider's
 * `onStoreChange`, which ALSO triggers `recomputeLiveStatus` on every
 * mutation (see the provider above). `start()` is idempotent; calling
 * it twice is a no-op.
 *
 * On call, primes the Status pill once from the hydrated cache so the
 * footer isn't blank on first render.
 */
export function startLiveScheduler(): void {
  scheduler.start();
  void recomputeLiveStatus().catch(() => {});
}

export function stopLiveScheduler(): void {
  scheduler.stop();
}

// Debug log when `chrome.alarms` is unavailable — the shared scheduler
// handles the missing shim gracefully, but this trace makes it obvious
// to anyone triaging "why aren't my workflows refreshing" on a Firefox
// mv2 test path.
if (!alarms) {
  logger.debug('LiveScheduler', 'chrome.alarms unavailable — live scheduler disabled');
}
