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
  canAttempt as canCircuitAttempt,
  collectRequestTemplateStrings,
  computeNextFireAt as computeNextFireAtCore,
  initialCircuitSnapshot,
  isLiveVariableEffective,
  isWorkflowEffective,
  MAX_BACKOFF_SECONDS,
  MIN_ALARM_DELAY_MS,
  scanTemplateReferencesMany,
} from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { report as reportStatus } from '@/shared/status';
import { extensionStorage, OH } from '@/shared/storage';
import { getActiveEnvironmentId, onActiveEnvironmentChange } from './environment-store';
import {
  listCachesForWorkflow,
  listWorkflowRunCaches,
  markProbeStartForRun,
  onLiveCacheStoreChange,
  recordRefreshError,
  resetCircuitForRun,
  type WorkflowRunCache,
} from './live-cache-store';
import {
  getLiveVariables,
  getLiveVariablesForWorkflow,
  getLiveVariablesForWorkflowInWorkspace,
  onLiveVariableStoreChange,
} from './live-variable-store';
import { getLiveWorkflowInWorkspace, getLiveWorkflows, onLiveWorkflowStoreChange } from './live-workflow-store';
import { recordLog } from './observability-log';
import { createAlarmNameCodec, type RefreshProvider, RefreshScheduler } from './refresh-scheduler';
import { getRequest } from './request-store';
import { getActiveWorkspaceId, onActiveWorkspaceChange } from './workspace-store';

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
   *
   * `bypass: true` signals that the caller is running a manual-bypass
   * attempt against an OPEN circuit — the adapter MUST route failure
   * writes through `recordManualBypassFailureForRun` (preserves
   * `nextAttemptAt` + `consecutiveOpenings`) instead of the normal
   * `recordRefreshError` path. Success writes go through the usual
   * `putWorkflowRunCache` either way; success closes the circuit.
   */
  refreshWorkflow(args: {
    workspaceId: string;
    workflow: V5.LiveWorkflow;
    environmentId: string | null;
    bypass?: boolean;
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
  if (!isWorkflowEffective(workflow)) return false;
  const hasEffectiveBinding = boundVariables.some((v) => isLiveVariableEffective(v));
  if (!hasEffectiveBinding) return false;
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
    // Cadence math consults this first when present — OPEN states
    // schedule to `circuit.nextAttemptAt`, pre-breaker CLOSED failures
    // get the 5s±5s tier. The fallback to `initialCircuitSnapshot`
    // mirrors `normalizeBlob`'s per-row tolerant read.
    circuit: run.circuit ?? initialCircuitSnapshot(),
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
//
// Active-workspace-only: the scheduler ONLY refreshes workflows that
// belong to the workspace the user is currently using. Inactive
// workspaces' workflows go quiet on disk — their cache rows survive
// (so switching back finds them still-fresh within the cadence
// window) but no alarms fire for them. This is by design:
//   • OAuth refresh tokens for unused workspaces stop rotating
//     server-side, shrinking the always-live attack surface.
//   • Battery + network costs scale with what the user actually
//     touches, not with how many workspaces exist on disk.
//   • Refresh failures (rotated creds, locked accounts, network
//     blips) only generate noise for workspaces the user can
//     observe + fix.
//
// On workspace switch, `kickActiveContextRefresh` (below) drives a
// best-effort warm pass for the new context's missing/stale rows so
// the user doesn't see a silent "no cache for env X" gap on a
// workspace they actively work in.

async function collectEntries(): Promise<LiveEntry[]> {
  const activeWorkflows = getLiveWorkflows();
  const activeId = (await extensionStorage.get(OH.runtimeActive)) ?? '';
  if (activeWorkflows.length === 0 || typeof activeId !== 'string' || activeId.length === 0) return [];

  const out: LiveEntry[] = [];
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
  return out;
}

// ── Dependency graph ─────────────────────────────────────────────
//
// Workflow A depends on Workflow B when A's step requests reference a
// `{{live.X}}` whose LV binds to B. The shared `RefreshScheduler`
// reconcile uses this graph to depth-sort alarms so downstream
// refreshes fire AFTER upstream on the same wake wave, and to spread
// the cohort across the per-host rate limiter's budget.
//
// All entries belong to the active workspace (active-workspace-only
// scheduling — see `collectEntries`). Step requests resolve through
// `request-store.getRequest`'s synchronous active-workspace view; a
// missing lookup degrades to "no deps for this entry," equivalent to
// scheduling in definition order (the plan's documented fallback when
// a graph can't be resolved).

function computeWorkflowDependencies(entries: LiveEntry[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (entries.length === 0) return out;

  // Build an LV-name → workflow-uid index ONCE per reconcile. Only
  // effective LVs (published + enabled) produce values that would
  // trigger a rebuild of the consuming rule set, so a draft / disabled
  // binding doesn't warrant a dep edge.
  const lvNameToWorkflow = new Map<string, string>();
  for (const lv of getLiveVariables()) {
    if (isLiveVariableEffective(lv)) lvNameToWorkflow.set(lv.name, lv.workflowUid);
  }
  if (lvNameToWorkflow.size === 0) return out;

  const entryAlarmByWorkflowKey = new Map<string, string>();
  for (const entry of entries) {
    const alarm = codec.encode({ w: entry.workspaceId, u: entry.workflow.uid, e: entry.environmentId });
    // Key by (workspace, workflow) — same workflow in different envs
    // gets distinct alarms but shares the dependency edges (the step
    // requests are identical; the cache is what varies).
    entryAlarmByWorkflowKey.set(`${entry.workspaceId}:${entry.workflow.uid}`, alarm);
  }

  for (const entry of entries) {
    const parents: string[] = [];
    const seen = new Set<string>();
    for (const step of entry.workflow.steps) {
      const request = getRequest(step.requestUid);
      if (!request) continue;
      const templates = collectRequestTemplateStrings(request);
      if (templates.length === 0) continue;
      const { live } = scanTemplateReferencesMany(templates);
      for (const name of live) {
        const producerUid = lvNameToWorkflow.get(name);
        if (!producerUid || producerUid === entry.workflow.uid) continue; // self-ref doesn't form an edge
        const parentAlarm = entryAlarmByWorkflowKey.get(`${entry.workspaceId}:${producerUid}`);
        if (parentAlarm && !seen.has(parentAlarm)) {
          seen.add(parentAlarm);
          parents.push(parentAlarm);
        }
      }
    }
    if (parents.length === 0) continue;
    const selfAlarm = codec.encode({ w: entry.workspaceId, u: entry.workflow.uid, e: entry.environmentId });
    out.set(selfAlarm, parents);
  }

  return out;
}

// ── Provider — fills in the subsystem-specific bits ───────────────

const provider: RefreshProvider<LiveAlarmPayload, LiveEntry, WorkflowRunCache | null> = {
  alarmPrefix: LIVE_ALARM_PREFIX,
  decodeAlarm: (name) => codec.decode(name),
  encodeAlarm: (entry) => codec.encode({ w: entry.workspaceId, u: entry.workflow.uid, e: entry.environmentId }),
  encodeAlarmFromPayload: (payload) => codec.encode(payload),
  listAll: () => collectEntries(),
  async getByAlarm(payload) {
    // Per-workspace lookup (MWPT-FULL session #19). The previous
    // implementation rejected when `payload.w !== runtime-Active` —
    // documented as "orphan alarm: cancel" — but that conflated two
    // distinct conditions:
    //   1. The workspace is GONE (deleted) — the per-workspace cache
    //      lookup below returns null, which the shared RefreshScheduler
    //      correctly interprets as "orphan — cancel."
    //   2. The workspace is ALIVE but not currently runtime-Active —
    //      legitimate target for cross-workspace dispatch (the user is
    //      on workspace-2 in per-tab mode and clicked "Refresh now"
    //      against a workspace-2 workflow). Cancelling this alarm under
    //      the v1.3 framing produced "Workflow X not found in workspace
    //      Y" for every cross-workspace gesture.
    // Reading via the per-workspace {@link LiveWorkflowCache} +
    // {@link LiveVariableCache} preserves the (1) behavior (cache
    // missing → null → cancel) while unblocking (2) cleanly.
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
  computeNextFireAt: (entry, nowMs) => computeNextFireAtCore(entry.workflow, toCacheSummary(entry.cache), nowMs),
  canSchedule: (entry) => canScheduleWorkflow(entry.workflow, entry.boundVariables),
  computeDependencies: (entries) => computeWorkflowDependencies(entries),
  async refresh(entry, payload) {
    if (!refreshAdapter) {
      // Phase C shipped before Phase D. Record a scheduler-not-ready
      // error so the cache's failure counter widens and we don't
      // hot-loop. Throws so the scheduler routes into `onFailed`.
      throw new LiveSchedulerNotReadyError(
        `scheduler-not-ready: no refresh adapter installed for workflow ${payload.u}`,
      );
    }
    // Offline gate — check BEFORE touching the circuit. Offline blips
    // must not advance the state machine (see `OfflineError` comment).
    // The 'online' event handler in `background.ts` re-reconciles +
    // kicks catch-up when connectivity returns.
    if (!isNetworkOnline()) {
      throw new OfflineError(`offline: workflow ${payload.u} refresh skipped (navigator.onLine=false)`);
    }
    // Circuit-aware attempt gate. If the cache says the circuit is
    // OPEN and we haven't reached `nextAttemptAt` yet, bail out of
    // the dispatch — Chrome alarms can wake us "early" on some
    // platforms + a races between concurrent reconciles could also
    // schedule an attempt before the backoff window. Throwing a
    // neutral error routes through `onFailed` → `recordFailure`; the
    // provider's `recordFailure` consults the circuit and applies the
    // right transition without double-counting.
    const now = Date.now();
    const cacheCircuit = entry.cache?.circuit ?? null;
    if (cacheCircuit && !canCircuitAttempt(cacheCircuit, now)) {
      throw new CircuitBlockedError(
        `circuit-blocked: workflow ${payload.u} (state=${cacheCircuit.state}, nextAttemptAt=${cacheCircuit.nextAttemptAt})`,
      );
    }
    // Before dispatching an `open`-eligible probe, persist the
    // `open → half-open` transition so the UI shows "probing..." and
    // a subsequent `recordRefreshError` correctly lands on the
    // half-open branch of `onCircuitFailure` (which bumps the
    // backoff curve). No-op for already-half-open / already-closed
    // states.
    if (cacheCircuit?.state === 'open') {
      await markProbeStartForRun(payload.u, payload.e, now, payload.w);
    }
    await refreshAdapter.refreshWorkflow({
      workspaceId: entry.workspaceId,
      workflow: entry.workflow,
      environmentId: entry.environmentId,
    });
  },
  async recordFailure(payload, err, job) {
    // `CircuitBlockedError` / `OfflineError` — both sentinels fire
    // when `provider.refresh` bailed BEFORE the adapter ran. No probe
    // happened, no counter bump, no cache write. Return the existing
    // cache row so `onFailed` has something to log; re-arm the alarm
    // so the next fire lines up with the correct target (cadence for
    // offline, `nextAttemptAt` for circuit-blocked). Explicit
    // schedule call because skipping the cache write also skipped
    // the store-change reconcile loop that normally re-arms alarms.
    if (err instanceof CircuitBlockedError || err instanceof OfflineError) {
      if (job) {
        void scheduler.schedule(job).catch((e) => logger.warn('LiveScheduler', 'Re-schedule after skip failed', e));
      }
      return job?.cache ?? null;
    }
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
    // adapter bubble is `error`; a circuit-blocked (early fire) is
    // `debug` — not a failure, just a no-op we're logging for
    // traceability. Unlike OAuth we don't escalate per attempt
    // count — Phase G's Status pill already aggregates consecutive
    // failures into yellow/red, so per-entry log-level churn would
    // add noise without new signal.
    const isStub = err instanceof LiveSchedulerNotReadyError;
    const isBlocked = err instanceof CircuitBlockedError;
    const isOffline = err instanceof OfflineError;
    const isNoOp = isBlocked || isOffline;
    recordLog({
      subsystem: 'live',
      op: 'refresh-failed',
      // Observability LogLevel is ('info' | 'warn' | 'error') — no
      // debug tier. No-op skips (circuit-blocked, offline) fold into
      // 'info'. A real adapter failure stays at 'error'.
      level: isNoOp ? 'info' : isStub ? 'warn' : 'error',
      message: isOffline
        ? `Offline — refresh deferred for workflow ${payload.u}`
        : isBlocked
          ? `Circuit open for workflow ${payload.u} — refresh declined`
          : isStub
            ? `No refresh adapter for workflow ${payload.u} (Phase D not yet wired)`
            : `Refresh failed for ${payload.u}: ${err.message}`,
      context: {
        workspaceId: payload.w,
        workflowUid: payload.u,
        environmentId: payload.e,
        errorClass: isOffline ? 'Offline' : isBlocked ? 'CircuitBlocked' : isStub ? 'SchedulerNotReady' : err.name,
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

/**
 * Sentinel error the provider throws when `canCircuitAttempt` refuses
 * a dispatch because the circuit is OPEN and `nextAttemptAt` hasn't
 * been reached yet. Not a real failure — the state machine is doing
 * its job. `recordFailure` returns the existing cache row without
 * mutating; `onFailed` logs at debug level. The error exists as a
 * class (rather than a magic string match) so TypeScript narrowing
 * catches every branch that needs to special-case the no-op path.
 */
class CircuitBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBlocked';
  }
}

/**
 * Thrown when an attempt is refused because the platform reports
 * `navigator.onLine === false`. Not a circuit failure — the provider
 * is (probably) fine; the client has no way to reach it. Treating
 * offline blips as circuit failures would race through all three
 * pre-breaker retries in 90 seconds (the 30s MV3 alarm floor clamps
 * the intended 5–10s pre-breaker delay) and open the circuit before
 * the user even notices they're offline. Mirrors v4's behavior where
 * `NetworkService.on('offline')` paused the refresh scheduler instead
 * of letting it hammer the circuit.
 *
 * The 'online' event handler in `background.ts` explicitly reconciles
 * + kicks overdue workflows when connectivity returns, so missed
 * windows get caught up without contributing to backoff state.
 */
class OfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Offline';
  }
}

/**
 * Read the SW's current online/offline signal. Best-effort:
 * `navigator.onLine` can be stale (the browser only flips it on a
 * confirmed platform event), and SWs in some test harnesses don't
 * expose the global at all — fail open (assume online) when absent.
 */
function isNetworkOnline(): boolean {
  try {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine;
  } catch {
    return true;
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

/**
 * Synchronously refresh a workflow for the DNR compile path's
 * sync-warm contract. Drives the same adapter call the alarm path
 * uses (same cache-write discipline + observability), but exposes a
 * return-when-done Promise so callers can race it against a timeout.
 *
 * Used by `computeRuleLiveBypass`'s sibling, `kickSyncWarmRefreshes`,
 * in the rule-engine pre-compile step — rules with
 * `requireFreshOnRuleBuild` on their live dependencies get the
 * latest cached values before DNR rewrites fire.
 *
 * Errors bubble (caller decides whether to swallow). The cache is
 * written regardless — success writes the new captures; failure
 * preserves the last-good row and increments the failure counter.
 */
export async function refreshLiveWorkflowSynchronously(
  workspaceId: string,
  workflowUid: string,
  environmentId: string | null,
): Promise<void> {
  return scheduler.handleAlarm({
    name: buildAlarmName(workspaceId, workflowUid, environmentId),
    scheduledTime: Date.now(),
  } as chrome.alarms.Alarm);
}

/**
 * Drive an opportunistic warm pass for the active (workspace, env)
 * context. Called when the user switches workspaces or environments.
 *
 * Walks the active workspace's enabled live variables; for each one
 * whose backing workflow has NO cache row (or a stale one) for the
 * new active env, enqueues a refresh via the alarm path. The alarm
 * path fires immediately when scheduled with a 0-delay window, then
 * the standard cadence resumes from the new extractedAt.
 *
 * Intentionally fire-and-forget — the caller (workspace/env switch)
 * shouldn't block UI on N OAuth round-trips. Sync-warm LVs
 * (`requireFreshOnRuleBuild: true`) get a separate blocking path
 * inside the DNR compile pipeline; this hook covers the async-warm
 * majority who should see fresh values "soon" after a switch without
 * blocking the switch itself.
 *
 * Throttling: the underlying RefreshScheduler honors the per-host
 * rate limiter, so kicking 10 refreshes for the same provider host
 * spreads them across the budget rather than slamming the endpoint.
 */
export async function kickActiveContextRefresh(
  activeWorkspaceId: string,
  activeEnvironmentId: string | null,
  nowMs: number = Date.now(),
): Promise<void> {
  const workflows = getLiveWorkflows();
  if (workflows.length === 0) return;
  // Only effective bindings (published + enabled) trigger a warm pass —
  // a draft / disabled LV's workflow has nothing to satisfy.
  const lvs = getLiveVariables().filter((v) => isLiveVariableEffective(v));
  if (lvs.length === 0) return;

  // De-dupe targets: many LVs may bind the same workflow, but one
  // workflow run produces every binding's value. Map lookup by uid.
  const targetWorkflowUids = new Set<string>();
  for (const lv of lvs) targetWorkflowUids.add(lv.workflowUid);

  for (const workflow of workflows) {
    if (!targetWorkflowUids.has(workflow.uid)) continue;
    const runs = await listCachesForWorkflow(workflow.uid, activeWorkspaceId);
    const cache = runs.find((r) => r.environmentId === activeEnvironmentId) ?? null;
    if (cache != null) {
      // Existing row — let the cadence math decide whether it needs
      // a refresh now (expired / stale). `scheduleLiveWorkflowRefresh`
      // is a no-op when the next-fire time is far in the future.
      const summary = toCacheSummary(cache);
      const nextAt = computeNextFireAtCore(workflow, summary, nowMs);
      // Already fresh + scheduled — nothing to do.
      if (nextAt != null && nextAt - nowMs > MIN_ALARM_DELAY_MS * 2) continue;
    }
    const boundVariables = getLiveVariablesForWorkflow(workflow.uid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    // Fire-and-forget: we want the switch to feel snappy, not block
    // on chains that may take seconds. Failures land in observability
    // through the normal alarm-failure path.
    void refreshLiveWorkflowSynchronously(activeWorkspaceId, workflow.uid, activeEnvironmentId).catch((err) => {
      logger.info(
        'LiveScheduler',
        `kickActiveContextRefresh failed for ${workflow.uid} env=${activeEnvironmentId ?? '__none__'}: ${(err as Error).message}`,
      );
    });
  }
}

/**
 * Run a workflow once on an explicit user request (the "Refresh now"
 * button in the Live Workflow editor + Live Variable list + the
 * Workflow Status sidebar). Bypasses BOTH the `canScheduleWorkflow`
 * binding gate AND the circuit-breaker `canAttempt` gate when the
 * circuit is OPEN.
 *
 * Gates we bypass:
 *   • `canScheduleWorkflow` — alarm path declines orphan workflows
 *     (enabled=false OR no bound LVs) to avoid wasting MV3 alarm
 *     quota on a dispatch that wouldn't affect any rule. Manual
 *     refresh is the opposite shape: the user often diagnoses a
 *     workflow BEFORE binding an LV (run it, inspect captures,
 *     decide which to expose). So we skip this gate.
 *   • `canAttempt` — when the user clicks Retry while the circuit is
 *     OPEN, they're explicitly overriding the backoff window ("I know
 *     something; try anyway"). Mirrors v4
 *     `AdaptiveCircuitBreaker.executeWithBypass(bypassIfOpen=true)`.
 *
 * Failure handling (the key asymmetry with the alarm path):
 *   • When the circuit was OPEN at the time of the bypass, a failure
 *     writes via `recordManualBypassFailureForRun`, which updates the
 *     error-detail fields but leaves `nextAttemptAt`, `consecutive
 *     Openings`, and `consecutiveFailures` at their pre-bypass values.
 *     The user's click doesn't push the next scheduled retry further
 *     out — the backoff curve stays exactly where it was.
 *   • When the circuit was CLOSED or HALF-OPEN, the regular failure
 *     path applies (pre-breaker counter / probe-failure handling).
 *
 * Success handling is uniform: `putWorkflowRunCache` → `onCircuitSuccess`
 * closes the circuit + applies the openings-decay rule regardless of
 * entry state. So a successful bypass fully recovers the workflow.
 *
 * Errors bubble so the caller (message-handler) can report a real
 * message to the user instead of the `scheduler-not-ready` fallback.
 */
export async function refreshLiveWorkflowByUser(
  workspaceId: string,
  workflowUid: string,
  environmentId: string | null,
): Promise<void> {
  const payload: LiveAlarmPayload = { w: workspaceId, u: workflowUid, e: environmentId };
  const job = await provider.getByAlarm(payload);
  if (!job) throw new Error(`Workflow ${workflowUid} not found in workspace ${workspaceId}`);

  // Offline guard — a manual click with no connectivity can't succeed
  // and shouldn't advance the circuit. Throw a clean message so the
  // message-handler can surface "You're offline" in the UI instead of
  // counting it as a fetch failure.
  if (!isNetworkOnline()) {
    throw new Error("You're offline — refresh will resume automatically when connectivity returns.");
  }

  const now = Date.now();
  const circuit = job.cache?.circuit ?? null;
  // "Bypass" semantics kick in ONLY when the circuit would otherwise
  // refuse the attempt right now (OPEN and `nowMs < nextAttemptAt`).
  // That's the scenario v4 `executeWithBypass` was designed for:
  // failure preserves the existing `nextAttemptAt` so the user's
  // clarifying click doesn't push the next auto-retry further out.
  //
  // When `canCircuitAttempt` is true (CLOSED / HALF-OPEN with probes
  // remaining / OPEN past nextAttemptAt), the retry is semantically
  // equivalent to a scheduled probe; run the regular adapter path so
  // state transitions are natural (openings bump on probe failure,
  // consecutiveFailures accumulates in the pre-breaker tier, etc.).
  const isBypassingGate = circuit !== null && !canCircuitAttempt(circuit, now);

  provider.onFired?.(payload);
  if (!refreshAdapter) {
    const err = new LiveSchedulerNotReadyError(`scheduler-not-ready: no refresh adapter for workflow ${workflowUid}`);
    provider.onFailed?.(payload, err, job.cache ?? null);
    throw err;
  }

  // Probe-start transition lives on the non-bypass path: when state
  // is OPEN + canAttempt=true (alarm-equivalent), transition to
  // half-open so `onCircuitFailure` lands on the half-open branch
  // (bumping `consecutiveOpenings`). Bypass path explicitly preserves
  // the OPEN state — no transition.
  if (!isBypassingGate && circuit?.state === 'open') {
    await markProbeStartForRun(workflowUid, environmentId, now, workspaceId);
  }

  try {
    await refreshAdapter.refreshWorkflow({
      workspaceId,
      workflow: job.workflow,
      environmentId,
      bypass: isBypassingGate,
    });
    provider.onSucceeded?.(payload);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    // Cache-write side effects already happened inside the adapter —
    // `bypass: true` routed the adapter's failure through
    // `recordManualBypassFailureForRun` (circuit preserved); the
    // normal path wrote via `recordRefreshError`. Either way, we
    // re-read the post-write cache so `onFailed`'s observability
    // entry reflects the latest counters.
    const fresh = await getCurrentCacheForPayload(payload);
    provider.onFailed?.(payload, error, fresh);
    throw error;
  }
}

/**
 * Read the current cache row for an alarm payload — used by the
 * manual-refresh entry point to pass post-write state into `onFailed`
 * without duplicating the store read logic from the provider itself.
 */
async function getCurrentCacheForPayload(payload: LiveAlarmPayload): Promise<WorkflowRunCache | null> {
  const runs = await listCachesForWorkflow(payload.u, payload.w);
  return runs.find((r) => r.environmentId === payload.e) ?? null;
}

/**
 * Reset the circuit for one `(workflow, env)` pair in the active
 * workspace. Surfaced as the Workflow Status sidebar's "Reset circuit"
 * action — clears failure counts + `consecutiveOpenings` + any
 * pending `nextAttemptAt` without running a probe. The next scheduled
 * or manual refresh starts from a clean slate.
 */
export async function resetCircuitForWorkflow(
  workspaceId: string,
  workflowUid: string,
  environmentId: string | null,
): Promise<void> {
  await resetCircuitForRun(workflowUid, environmentId, workspaceId);
}

// ── Status reporting ─────────────────────────────────────────────
//
// Active-workspace-only aggregation drives the `live` Status pill per
// the plan (§Observability → Status pill color rules):
//
//   green  — no cached runs with failures + no stale-beyond-2×-cadence
//            + lastExtractorOk on every run that has run at least once
//   yellow — any stale beyond 2× cadence OR lastExtractorOk=false OR
//            consecutiveFailures in 1..4
//   red    — any consecutiveFailures >= 5
//
// Inactive workspaces are deliberately excluded — the user can't see
// or act on those rules, so reporting on them yellow-pills the footer
// for state the user can't reach. When the user switches workspaces,
// the pill recomputes against the new active workspace.
//
// Values never appear in Status messages — only counts + the "first
// failing workflow" for a hint. Host-permission red (from §12) routes
// through the existing `permissions` pill; surfacing permissions state
// on the live pill would double-report and confuse the triage story.

const RED_FAILURE_THRESHOLD = 5;

async function recomputeLiveStatus(): Promise<void> {
  let runs: WorkflowRunCache[];
  try {
    // Active workspace only — `listWorkflowRunCaches()` with no arg
    // defaults to the active workspace's cache row set.
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
 * Also subscribes to `onActiveWorkspaceChange` and
 * `onActiveEnvironmentChange` so a switch in either pointer
 * automatically kicks an opportunistic warm pass for the new context.
 * Subscriptions live in the scheduler module (not at the call site of
 * the switch) so the orchestrator + RPC layers don't need to know
 * about scheduler internals — the source-of-truth stores emit events,
 * the scheduler reacts. Pure SoC.
 *
 * On call, primes the Status pill once from the hydrated cache so the
 * footer isn't blank on first render.
 */
export function startLiveScheduler(): void {
  scheduler.start();
  installSwitchWarmSubscriptions();
  void recomputeLiveStatus().catch(() => {});
}

export function stopLiveScheduler(): void {
  scheduler.stop();
  removeSwitchWarmSubscriptions();
}

// ── Switch-warm subscriptions ─────────────────────────────────────
//
// One listener each for active-workspace + active-env changes. Both
// trigger `kickActiveContextRefresh` for the new (workspace, env)
// pair. Subscriptions are torn down in `stopLiveScheduler` for test
// hygiene — the production SW never stops the scheduler, but tests
// that exercise start/stop pairs need clean teardown.

let switchWarmTeardown: Array<() => void> = [];

function installSwitchWarmSubscriptions(): void {
  if (switchWarmTeardown.length > 0) return; // idempotent
  const onWs = onActiveWorkspaceChange((newWsId) => {
    void kickActiveContextRefresh(newWsId, getActiveEnvironmentId()).catch((err) => {
      logger.info('LiveScheduler', `kickActiveContextRefresh after workspace switch failed: ${(err as Error).message}`);
    });
  });
  const onEnv = onActiveEnvironmentChange((newEnvId) => {
    // Workspace doesn't change on an env switch — read the current
    // active workspace synchronously from workspace-store. The earlier
    // async storage read introduced a microtask delay between the
    // switch and the warm pass for no benefit (workspace-store has a
    // sync accessor for the same value).
    let wsId: string;
    try {
      wsId = getActiveWorkspaceId();
    } catch {
      // Bootstrap race — workspace pointer not yet hydrated. The
      // initial reconcile-on-wake handles seeding; nothing to warm.
      return;
    }
    void kickActiveContextRefresh(wsId, newEnvId).catch((err) => {
      logger.info('LiveScheduler', `kickActiveContextRefresh after env switch failed: ${(err as Error).message}`);
    });
  });
  switchWarmTeardown = [onWs, onEnv];
}

function removeSwitchWarmSubscriptions(): void {
  for (const unsub of switchWarmTeardown) unsub();
  switchWarmTeardown = [];
}

// Debug log when `chrome.alarms` is unavailable — the shared scheduler
// handles the missing shim gracefully, but this trace makes it obvious
// to anyone triaging "why aren't my workflows refreshing" on a Firefox
// mv2 test path.
if (!alarms) {
  logger.debug('LiveScheduler', 'chrome.alarms unavailable — live scheduler disabled');
}
