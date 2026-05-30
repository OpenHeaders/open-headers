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
  computeDeferredFireAt,
  computeNextFireAt as computeNextFireAtCore,
  electOfflineFallbackRunner,
  initialCircuitSnapshot,
  isLiveVariableEffective,
  isWithinDeferHatchWindow,
  MAX_BACKOFF_SECONDS,
  MIN_ALARM_DELAY_MS,
} from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { getActiveEnvironmentId, onActiveEnvironmentChange } from '@openheaders/oracle/entity/environment-store';
import { onRequestStoreChange } from '@openheaders/oracle/entity/request-store';
// LF1–LF4 definitional-freshness detectors are host-neutral; this
// module wires them via the `refreshNow` seam and re-exports the
// test/maintenance helpers below.
import {
  __resetLiveCascadeBaseline,
  __resetWorkflowDefinitionBaseline,
  __setLiveCascadeRefreshDebounceMs,
  __setRequestEditRefreshDebounceMs,
  __setVariableEditRefreshDebounceMs,
  startDefinitionalFreshness,
  stopDefinitionalFreshness,
} from '@openheaders/oracle/live/definitional-freshness';
import {
  deriveExecutionPolicyForWorkflow,
  isFallbackEligibleForWorkflow,
} from '@openheaders/oracle/live/execution-policy-resolver';
import {
  listCachesForWorkflow,
  listWorkflowRunCaches,
  markExclusiveDegradedForRun,
  markProbeStartForRun,
  onLiveCacheStoreChange,
  recordRefreshError,
  resetCircuitForRun,
  type WorkflowRunCache,
} from '@openheaders/oracle/live/live-cache-store';
import {
  getLiveVariables,
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
import { hostStorage, OH } from '@openheaders/oracle/storage';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { recordLog } from './observability-log';
import { createAlarmNameCodec, type RefreshProvider, RefreshScheduler } from './refresh-scheduler';
import { getActiveWorkspaceId, onActiveWorkspaceChange } from './workspace-store';

// Re-export the lifted gate + definitional-freshness maintenance hooks
// so the scheduler's existing external callers + unit tests keep their
// import surface (the implementations now live host-neutral in oracle).
export {
  __resetLiveCascadeBaseline,
  __resetWorkflowDefinitionBaseline,
  __setLiveCascadeRefreshDebounceMs,
  __setRequestEditRefreshDebounceMs,
  __setVariableEditRefreshDebounceMs,
  canScheduleWorkflow,
};

/**
 * Defensive workspace-service bracket for refresh entry points
 * (manual + alarm + sync-warm). Materializes the workspace's service
 * if it isn't already resident, awaits its `hydrated` promise so the
 * caches are populated from chrome.storage, runs the operation, and
 * releases the refcount in `finally`. This guarantees the F-12/F-13
 * "workflow not found in workspace" failure cannot reproduce when the
 * workspace's lifeline-driven refcount has dropped (e.g. during the
 * 30s grace window) — the operation re-acquires for its duration.
 */
async function withWorkspaceResident<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const svc = getOrCreateWorkspaceService(workspaceId);
  try {
    await svc.hydrated;
    return await fn();
  } finally {
    releaseWorkspaceService(workspaceId);
  }
}

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
    workflow: LiveWorkflow;
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

// ── Cadence ownership: backend-connection probe (WS-C C8) ─────────
//
// A peer with a connected backend defers its own cadence for any
// (workflow, env) whose value is remote-sourced, letting the backend be
// the sole runner (coherence for the idempotent class; correctness for
// the exclusive class). The scheduler must NOT import `websocket.ts` (a
// host transport concern) — instead the bootstrap injects a probe, the
// same inversion `__setLiveRefreshAdapter` uses. Until a probe is
// installed (e.g. in-browser-only mode, or tests) `isBackendConnected`
// is false and deferral is entirely off — the scheduler behaves exactly
// as a self-sufficient Mode-1 runner.
//
// The bootstrap also re-`reconcile`s on every socket open/close so the
// arm/defer choice re-evaluates the instant connectivity flips: on close
// a deferring peer drops back to its normal (earlier) cadence; on open
// it re-defers once synced values start landing (which re-stamp
// `lastSyncedValueAt`).

let backendConnectionProbe: (() => boolean) | null = null;

/**
 * Install (or clear) the backend-connection probe. The bootstrap wires
 * this to `isWebSocketConnected`; tests install a stub. `null` disables
 * deferral (no backend → self-sufficient runner).
 */
export function setBackendConnectionProbe(probe: (() => boolean) | null): void {
  backendConnectionProbe = probe;
}

function isBackendConnected(): boolean {
  try {
    return backendConnectionProbe?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Cadence-ownership override (WS-C C8). Given the *normal* lead-time fire
 * the core cadence math computed, decide whether this peer should instead
 * arm the later near-expiry safety fire and defer to the backend.
 *
 * Defers only a **healthy, remote-sourced** row while **connected**: a
 * row this host is failing on (circuit non-closed / `consecutiveFailures`)
 * stays on its backoff curve, a definitionally-stale row keeps its
 * fire-ASAP, and a locally-produced row (no `lastSyncedValueAt`) keeps
 * its own cadence. The deferred fire is used only when it lands *later*
 * than the normal cadence — never pull a refresh earlier — so the backend
 * (which fires at its own larger lead) gets the first shot.
 */
function applyDeferOverride(cache: WorkflowRunCache | null, normalFireAt: number | null, nowMs: number): number | null {
  if (normalFireAt == null) return normalFireAt; // manual / unschedulable — never defer
  if (!isBackendConnected()) return normalFireAt;
  if (!cache || cache.lastSyncedValueAt == null || cache.expiresAt == null) return normalFireAt;
  if (cache.consecutiveFailures > 0 || cache.definitionallyStale) return normalFireAt;
  if (cache.circuit && cache.circuit.state !== 'closed') return normalFireAt;
  const deferred = computeDeferredFireAt(cache.expiresAt, nowMs);
  return deferred > normalFireAt ? deferred : normalFireAt;
}

// ── Offline fallback: priority probe (WS-C C14) ───────────────────
//
// When a configured backend goes OFFLINE, an *exclusive* workflow may be
// refreshed by exactly one host across the now-partitioned browsers (a
// concurrent run burns the single-use cred). Each peer decides locally
// from its frozen, last-synced priority list + its own seed eligibility
// (`electOfflineFallbackRunner`). The list + this host's identity come
// from the data plane (C14 commit 2 wires the synced entity + auto-seed);
// the scheduler reaches them through this injected probe — the same
// inversion `setBackendConnectionProbe` uses, so the scheduler never
// imports the backend-settings or identity layers.
//
// The probe's RETURN encodes "is a backend configured at all":
//   • `null`  → pure Mode-1 (no backend ever attached). The SW is the
//     legitimate sole runner and self-refreshes every class, exclusive
//     included (plan §8 non-goal — Mode-1 keeps its self-sufficient
//     runner). The C14 gate stays entirely off.
//   • non-null → a backend is configured (currently offline). The gate
//     engages for the exclusive class: only the elected host self-refreshes.
//     An empty `order` is the SAFE default — nobody is elected, so every
//     peer banners rather than racing (`no-list`).

export interface FallbackPrioritySnapshot {
  /** Frozen last-synced priority order — ordered `Principal.id`s. Empty until C14 commit 2 wires the synced entity. */
  order: readonly string[];
  /** This host's stable `Principal.id` (derived from `hostInstallId`), or null if not yet known. */
  selfPrincipalId: string | null;
}

let fallbackPriorityProbe: (() => FallbackPrioritySnapshot | null) | null = null;

/**
 * Install (or clear) the offline-fallback priority probe. The bootstrap
 * wires this to the configured backend's frozen priority list + this
 * host's identity; tests install a stub. `null` (or a probe returning
 * `null`) disables the gate — pure Mode-1 self-refreshes every class.
 */
export function setFallbackPriorityProbe(probe: (() => FallbackPrioritySnapshot | null) | null): void {
  fallbackPriorityProbe = probe;
}

function readFallbackPriority(): FallbackPrioritySnapshot | null {
  try {
    return fallbackPriorityProbe?.() ?? null;
  } catch {
    return null;
  }
}

// ── Cache summary projection ──────────────────────────────────────
//
// The schedulability gate (`canScheduleWorkflow`) is host-neutral and
// lives in `@openheaders/oracle/live/scheduling-gate`; this module
// re-exports it (see imports) for its external callers + tests.

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
    // A definitionally-stale row's recipe changed — the cadence math
    // overrides the healthy tick to "fire ASAP" so the wrong-recipe
    // value is not served until natural expiry.
    definitionallyStale: run.definitionallyStale,
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
  workflow: LiveWorkflow;
  boundVariables: LiveVariable[];
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
  const activeId = (await hostStorage.get(OH.runtimeActive)) ?? '';
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
  computeNextFireAt: (entry, nowMs) =>
    applyDeferOverride(entry.cache, computeNextFireAtCore(entry.workflow, toCacheSummary(entry.cache), nowMs), nowMs),
  canSchedule: (entry) => canScheduleWorkflow(entry.workflow, entry.boundVariables),
  computeDependencies: (entries) => computeWorkflowDependencies(entries, (w, u, e) => codec.encode({ w, u, e })),
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
    // Cadence-ownership guard (WS-C C8 + C9 + C10). While a backend is
    // connected it owns the cadence, and the load-bearing invariant is:
    // a peer NEVER self-refreshes an *exclusive* credential while
    // connected (a concurrent run burns a single-use TOTP code / trips
    // OAuth reuse-detection and silently revokes the session). The
    // backend is the sole runner; the peer defers, degrades, or fences
    // — three exits keyed on freshness + proof + execution policy.
    const now = Date.now();
    if (isBackendConnected()) {
      const expiresAt = entry.cache?.expiresAt ?? null;
      const synced = entry.cache?.lastSyncedValueAt != null;
      // (1) C8 — fresh remote-sourced value. The near-expiry SAFETY fire
      //     `applyDeferOverride` armed fired early (Chrome early-wake, or a
      //     fresher synced value mid-flight before its store-change
      //     reconcile re-armed us). Re-defer for every class; the backend's
      //     next push reschedules us later.
      if (synced && expiresAt != null && !isWithinDeferHatchWindow(expiresAt, now)) {
        throw new DeferredError(`deferred: workflow ${payload.u} — backend owns cadence, synced value still fresh`);
      }
      // Not comfortably fresh. Idempotent rows fall through and self-refresh
      // (preserves the 401-safety the feature sells — N concurrent mints are
      // at worst wasteful); only the exclusive class is held back.
      const { policy } = deriveExecutionPolicyForWorkflow(entry.workspaceId, entry.workflow, entry.environmentId);
      if (policy === 'exclusive') {
        if (synced && expiresAt != null) {
          // (2) C9 — we had PROOF the backend was producing this value (a
          //     remote value landed, with a derivable expiry) and it has now
          //     reached the near-expiry window with nothing fresher: the
          //     backend went silent/failing (a healthy backend keeps pushing
          //     expiry out, so the safety fire never lands). Mark the row
          //     degraded so the Status pill says "reconnect the desktop,"
          //     and re-defer rather than race.
          await markExclusiveDegradedForRun(payload.u, payload.e, now, payload.w);
          throw new ExclusiveDeferredError(
            `exclusive-deferred: workflow ${payload.u} — exclusive cred, backend silent near expiry; degrading instead of racing`,
          );
        }
        // (3) C10 — no proof yet: this host has never received a §4 value
        //     for the row (`lastSyncedValueAt == null`), or the synced value
        //     carries no derivable expiry. Either the backend's first
        //     catch-up value is still in flight (the Mode-1 connect edge a
        //     mid-cycle exclusive alarm would otherwise race) or the backend
        //     simply doesn't run this workflow. Decline to be the first
        //     runner of an exclusive cred while a backend is present; wait
        //     for its value. Stay SILENT — a transient catch-up gap mustn't
        //     flap the degraded banner, and a persistent gap surfaces via
        //     the generic stale-yellow path (C7/C14 own the messaging).
        throw new ConnectFenceError(
          `connect-fenced: workflow ${payload.u} — exclusive cred, backend connected but no synced value yet; declining to race`,
        );
      }
    } else {
      // WS-C C14 — a configured backend is OFFLINE (the probe returns a
      // snapshot) and this host is now a candidate runner. Idempotent
      // rows self-refresh on every partitioned peer (harmless — N mints
      // are at worst wasteful). For the EXCLUSIVE class only the single
      // ELECTED fallback host may run; the rest banner — else N
      // partitioned browsers race the single-use cred. Pure Mode-1 (probe
      // returns null) is deliberately NOT gated: the SW is the legitimate
      // sole runner (plan §8 — Mode-1 keeps its self-sufficient runner).
      const fallback = readFallbackPriority();
      if (fallback) {
        const { policy, reasons } = deriveExecutionPolicyForWorkflow(
          entry.workspaceId,
          entry.workflow,
          entry.environmentId,
        );
        if (policy === 'exclusive') {
          const verdict = electOfflineFallbackRunner({
            priorityList: fallback.order,
            selfPrincipalId: fallback.selfPrincipalId,
            eligible: isFallbackEligibleForWorkflow(entry.workspaceId, reasons),
          });
          if (!verdict.elected) {
            // Not the elected runner. Degrade the row so the Status pill
            // shows "reconnect the desktop app" — the offline non-elected
            // state wants the identical actionable resolution C9 raises,
            // so it reuses the same flag + banner (no new wire/state). The
            // flag clears the instant a fresher value syncs in (the
            // elected host's, on reconnect) or the backend returns and
            // produces. Re-arm at the cadence floor without racing.
            await markExclusiveDegradedForRun(payload.u, payload.e, now, payload.w);
            throw new FallbackNotElectedError(
              `fallback-not-elected: workflow ${payload.u} — exclusive cred, backend offline, ${verdict.reason}; banner instead of racing`,
            );
          }
          // Elected → fall through and self-refresh as the single offline
          // fallback runner.
        }
      }
    }
    // Circuit-aware attempt gate. If the cache says the circuit is
    // OPEN and we haven't reached `nextAttemptAt` yet, bail out of
    // the dispatch — Chrome alarms can wake us "early" on some
    // platforms + a races between concurrent reconciles could also
    // schedule an attempt before the backoff window. Throwing a
    // neutral error routes through `onFailed` → `recordFailure`; the
    // provider's `recordFailure` consults the circuit and applies the
    // right transition without double-counting.
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
    // `DeferredError` joins this skip-and-rearm family (WS-C C8): the
    // deferred safety alarm fired but a fresher synced value is still in
    // play. No probe happened, no counter bump — just re-arm so the next
    // fire lines up with the (possibly newly-pushed-out) near-expiry
    // threshold. `ExclusiveDeferredError` (WS-C C9) joins it too: the peer
    // declined to self-refresh an exclusive cred while the backend is
    // silent — re-arm at the cadence floor (≥30s, like the offline poll)
    // so the degraded banner clears promptly once the backend returns and
    // a fresh value lands. No freshness precondition — it is "waiting for
    // rescue," not "deferring to a live producer." `ConnectFenceError`
    // (WS-C C10) joins it as well: a connected peer declined to be the
    // first runner of an exclusive cred before any §4 value has landed.
    // Re-arm so a later tick re-checks; the row clears the moment the
    // backend's first synced value arrives (the store-change reconcile
    // beats any re-armed poll). `FallbackNotElectedError` (WS-C C14) joins
    // it too: a configured backend is offline and this peer is not the
    // elected single runner for an exclusive cred — it has already marked
    // the row degraded; re-arm at the cadence floor so the banner clears
    // promptly once the elected host's value syncs in or the backend
    // returns.
    if (
      err instanceof CircuitBlockedError ||
      err instanceof OfflineError ||
      err instanceof DeferredError ||
      err instanceof ExclusiveDeferredError ||
      err instanceof ConnectFenceError ||
      err instanceof FallbackNotElectedError
    ) {
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
    // Every live store mutation drives two things: the scheduler's
    // reconcile (its `callback` argument) and the `live` Status pill
    // recompute. Folding both into one listener per store keeps the
    // scheduler's subscription count at exactly one per store — which
    // is what the scheduler's unit tests assert. The LF1–LF4
    // definitional-freshness detectors are a separate concern: they
    // live host-neutral in `@openheaders/oracle/live/definitional-
    // freshness` and own their OWN store subscriptions (installed by
    // `startDefinitionalFreshness` in `startLiveScheduler`), so they
    // are deliberately NOT wired here.
    const combined = (): void => {
      callback();
      void recomputeLiveStatus().catch(() => {});
    };
    const unsubscribers: Array<() => void> = [
      onLiveWorkflowStoreChange(combined),
      onLiveVariableStoreChange(combined),
      onLiveCacheStoreChange(combined),
      // A request edit can add or drop a `{{live.X}}` template ref,
      // reshaping the cross-workflow dependency DAG `computeWorkflow
      // Dependencies` derives — reconcile re-derives the edges. (No
      // status recompute; a request edit touches no cache row.)
      onRequestStoreChange(callback),
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
    const { level, message, errorClass } = describeRefreshFailure(err, payload.u);
    recordLog({
      subsystem: 'live',
      op: 'refresh-failed',
      level,
      message,
      context: { workspaceId: payload.w, workflowUid: payload.u, environmentId: payload.e, errorClass },
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
 * Sentinel thrown when the cadence-ownership defer gate (WS-C C8)
 * declines a fire: this peer is connected to a backend and holds a
 * remote-sourced value that is still comfortably fresh, so the backend
 * owns the cadence. Not a failure — `recordFailure` re-arms the
 * (near-expiry) alarm without touching the circuit, and `onFailed` logs
 * it at info. A class (not a string match) so the narrowing in those two
 * branches is exhaustive.
 */
class DeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Deferred';
  }
}

/**
 * Sentinel thrown by the C9 near-expiry escape hatch when a connected peer
 * declines to self-refresh an *exclusive* credential whose producing backend
 * has gone silent near expiry. Not a failure — refreshing would burn the
 * single-use code / trip OAuth reuse-detection. `provider.refresh` has
 * already marked the row degraded (`markExclusiveDegradedForRun`) so the
 * Status pill surfaces "reconnect the desktop"; this only routes the no-op:
 * `recordFailure` re-arms at the cadence floor without touching the circuit,
 * and `onFailed` logs it at info. A class (not a string match) so the
 * narrowing in those branches stays exhaustive.
 */
class ExclusiveDeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExclusiveDeferred';
  }
}

/**
 * Sentinel thrown by the C10 connect-time fence when a connected peer
 * declines to be the *first* runner of an *exclusive* credential before
 * any §4 value has landed for the row (`lastSyncedValueAt == null`, or a
 * synced value with no derivable expiry). Closes the Mode-1 connect edge:
 * a mid-cycle exclusive alarm that would otherwise self-refresh, racing
 * the freshly-connected backend's first run (TOTP burn / OAuth
 * reuse-detection), is held back until the backend proves it is producing.
 * Not a failure — `recordFailure` re-arms without touching the circuit,
 * and `onFailed` logs it at info. Unlike C9 it does NOT degrade the row:
 * the gap is expected (catch-up in flight) and self-heals when the first
 * synced value lands; a persistent gap surfaces via the generic
 * stale-yellow path rather than a possibly-misleading "reconnect" banner.
 * A class (not a string match) so the narrowing in those branches stays
 * exhaustive.
 */
class ConnectFenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectFenced';
  }
}

/**
 * Sentinel thrown by the C14 offline fallback gate when a configured
 * backend is OFFLINE and this peer is NOT the elected single runner for an
 * *exclusive* credential (ineligible / unranked / outranked / no list).
 * Self-refreshing would race the other partitioned browsers on the
 * single-use cred. Not a failure — `provider.refresh` has already marked
 * the row degraded (`markExclusiveDegradedForRun`) so the Status pill
 * surfaces "reconnect the desktop"; this only routes the no-op:
 * `recordFailure` re-arms at the cadence floor without touching the
 * circuit, and `onFailed` logs it at info. The flag clears the moment the
 * elected host's value syncs in on reconnect, or the backend returns. A
 * class (not a string match) so the narrowing in those branches stays
 * exhaustive.
 */
class FallbackNotElectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FallbackNotElected';
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

/** Observability descriptor for a refresh failure. */
interface RefreshFailureDescriptor {
  level: 'info' | 'warn' | 'error';
  message: string;
  /** Stable machine tag for the log `context`, narrower than `err.name`. */
  errorClass: string;
}

/**
 * Map a refresh failure to its observability descriptor — one entry per
 * sentinel, so the log level lives beside its message + class instead of
 * across parallel ternary cascades.
 *
 * Most "failures" are deliberate **no-op skips**: a gate (offline / not the
 * elected fallback / backend owns cadence / connect-fence / circuit-open)
 * declined the fire. They log at `info` with a specific message — Phase G's
 * Status pill owns the yellow/red aggregation, so we don't escalate log
 * level per attempt the way OAuth does. The Phase-C stub logs `warn`; only
 * a genuine adapter bubble logs `error`.
 */
function describeRefreshFailure(err: Error, workflowUid: string): RefreshFailureDescriptor {
  if (err instanceof OfflineError) {
    return { level: 'info', errorClass: 'Offline', message: `Offline — refresh deferred for workflow ${workflowUid}` };
  }
  if (err instanceof FallbackNotElectedError) {
    return {
      level: 'info',
      errorClass: 'FallbackNotElected',
      message: `Backend offline for workflow ${workflowUid} — peer not the elected fallback runner, won't race (reconnect the desktop)`,
    };
  }
  if (err instanceof ExclusiveDeferredError) {
    return {
      level: 'info',
      errorClass: 'ExclusiveDeferred',
      message: `Exclusive cred degraded for workflow ${workflowUid} — backend silent, peer won't race (reconnect the desktop)`,
    };
  }
  if (err instanceof ConnectFenceError) {
    return {
      level: 'info',
      errorClass: 'ConnectFenced',
      message: `Backend connected but not yet producing for workflow ${workflowUid} — peer won't race the first exclusive run`,
    };
  }
  if (err instanceof DeferredError) {
    return {
      level: 'info',
      errorClass: 'Deferred',
      message: `Backend owns cadence for workflow ${workflowUid} — peer refresh deferred`,
    };
  }
  if (err instanceof CircuitBlockedError) {
    return {
      level: 'info',
      errorClass: 'CircuitBlocked',
      message: `Circuit open for workflow ${workflowUid} — refresh declined`,
    };
  }
  if (err instanceof LiveSchedulerNotReadyError) {
    return {
      level: 'warn',
      errorClass: 'SchedulerNotReady',
      message: `No refresh adapter for workflow ${workflowUid} (Phase D not yet wired)`,
    };
  }
  return { level: 'error', errorClass: err.name, message: `Refresh failed for ${workflowUid}: ${err.message}` };
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
    workflow: LiveWorkflow;
    boundVariables: LiveVariable[];
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
 * observability + records failure. Brackets the dispatch with a
 * workspace-service refcount so a workspace whose lifeline-driven
 * refcount dropped between alarm scheduling and alarm fire (typical
 * MV3 SW-eviction or a closed workbench tab) re-materializes for the
 * duration of the operation rather than failing with "workflow not
 * found in workspace".
 */
export async function handleLiveAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const decoded = codec.decode(alarm.name);
  if (!decoded) return scheduler.handleAlarm(alarm);
  return withWorkspaceResident(decoded.w, () => scheduler.handleAlarm(alarm));
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
  return withWorkspaceResident(workspaceId, () =>
    scheduler.handleAlarm({
      name: buildAlarmName(workspaceId, workflowUid, environmentId),
      scheduledTime: Date.now(),
    } as chrome.alarms.Alarm),
  );
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
  return withWorkspaceResident(workspaceId, () =>
    refreshLiveWorkflowByUserInner(workspaceId, workflowUid, environmentId),
  );
}

async function refreshLiveWorkflowByUserInner(
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
  let degraded = 0;
  let firstRed: string | undefined;
  let firstYellow: string | undefined;
  let firstDegraded: string | undefined;
  // The distinct backend-reported health categories across the degraded
  // rows (WS-C C7). When they agree we specialize the banner from a
  // backend-agnostic "reconnect" into "the backend's source/auth is
  // failing"; mixed or unknown falls back to the generic copy.
  const degradedHealths = new Set<string>();
  const now = Date.now();
  for (const run of runs) {
    if (run.consecutiveFailures >= RED_FAILURE_THRESHOLD) {
      red++;
      firstRed ??= run.workflowUid;
      continue;
    }
    // C9: a connected peer declined to refresh this exclusive credential
    // because its backend went silent. Surface the actionable "reconnect"
    // message ahead of the generic stale-yellow — the value will expire,
    // but a self-refresh would burn the cred, so the user must bring the
    // backend back rather than wait for this host to recover it.
    if (run.exclusiveDegradedSince != null) {
      degraded++;
      firstDegraded ??= run.workflowUid;
      degradedHealths.add(run.refreshHealth ?? 'unknown');
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
  if (degraded > 0) {
    const creds = `${degraded} exclusive credential${degraded === 1 ? '' : 's'} can't refresh`;
    // Specialize only when every degraded row agrees on the cause; the
    // backend is known-present here (the C9 degrade is set under a live
    // connection probe), so the enum just names *why* it isn't producing.
    const only = degradedHealths.size === 1 ? [...degradedHealths][0] : undefined;
    const message =
      only === 'auth-failing'
        ? `${creds} — the desktop app's authentication is failing`
        : only === 'source-failing'
          ? `${creds} — the desktop app's source is failing`
          : `${creds} — reconnect the desktop app`;
    reportStatus({
      subsystem: 'live',
      state: 'yellow',
      message,
      context: { degraded, firstDegraded },
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
  // The host-neutral definitional-freshness detectors (LF1–LF4) own
  // their own store subscriptions; the only host-specific seam is
  // `refreshNow` — the sync-warm adapter path the alarm dispatch uses,
  // so an edit-triggered active-env refresh carries the same cache-write
  // discipline + circuit handling.
  startDefinitionalFreshness({ refreshNow: refreshLiveWorkflowSynchronously });
  installSwitchWarmSubscriptions();
  void recomputeLiveStatus().catch(() => {});
}

export function stopLiveScheduler(): void {
  scheduler.stop();
  stopDefinitionalFreshness();
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
    // A chained-workflow cascade queued just before a switch away is
    // drained by the definitional-freshness module's own
    // `onActiveWorkspaceChange` subscription — no longer this module's
    // concern.
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
