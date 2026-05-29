/**
 * Desktop live-workflow refresh scheduler (WS-C C3).
 *
 * The main-process counterpart to the extension's alarm-driven
 * `live-refresh-scheduler.ts`. Because the desktop process is always-on,
 * it needs none of the browser ceremony the shared `RefreshScheduler`
 * carries — no `chrome.alarms`, no alarm-name codec, no reconcile-on-wake
 * or SW-eviction recovery. A plain in-memory `setTimeout` map keyed by
 * `(workspaceId, workflowUid, environmentId)` is the natural fit:
 *
 *   - cadence + backoff come from `@openheaders/core/live`
 *     (`computeNextFireAt`), the same math the browser uses;
 *   - the circuit gate (`canAttempt` / `markProbeStartForRun`) is the
 *     same host-neutral live-cache machinery;
 *   - each fire runs the chain via `./chain-runner`, which reuses the C1
 *     lifted resolve→execute core over the Node transport;
 *   - reconciliation is driven reactively off the host-neutral oracle
 *     store-change events (workflow / variable / cache / environment /
 *     request / workspace), debounced to collapse bursts.
 *
 * This module owns the pure cadence loop. The definitional-freshness
 * suite (LF1–LF4 immediate refresh-on-edit + the chained-workflow
 * cascade) is host-neutral in `@openheaders/oracle/live/definitional-
 * freshness` and wired here via the `refreshNow` seam (the gated
 * `fire`): now that the desktop is a value PRODUCER for deferring peers
 * (C6+), a request / variable / definition / upstream edit must
 * re-mint this host's value immediately rather than propagating a
 * wrong-recipe token until the next cadence tick.
 *
 * Active-workspace-only, exactly like the extension: only the workspace
 * the user is currently using has live timers. A workspace switch
 * re-hydrates the oracle stores, which fans the store-change events that
 * drive `reconcile`, so the timer set follows the active workspace
 * without a dedicated active-pointer subscription.
 */

import {
  type CacheSummary,
  canAttempt as canCircuitAttempt,
  computeNextFireAt,
  initialCircuitSnapshot,
} from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { getActiveEnvironmentId, onEnvironmentStoreChange } from '@openheaders/oracle/entity/environment-store';
import { onRequestStoreChange } from '@openheaders/oracle/entity/request-store';
import { startDefinitionalFreshness, stopDefinitionalFreshness } from '@openheaders/oracle/live/definitional-freshness';
import {
  listCachesForWorkflow,
  markProbeStartForRun,
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
import { getActiveWorkspaceId, onWorkspaceStoreChange } from '@openheaders/oracle/workspace/extension-workspace-store';
import { runDesktopWorkflowRefresh } from './chain-runner';
import { recomputeDesktopLiveStatus } from './live-status';

const LOG = 'DesktopLiveRunner';

/** Collapse a burst of store-change events into one reconcile pass. */
const RECONCILE_DEBOUNCE_MS = 50;

/**
 * `setTimeout` clamps a delay above `2^31 - 1` ms (~24.8 days) to fire
 * almost immediately. A cadence past that horizon (e.g. an `expires-at`
 * far in the future) is armed in `MAX_TIMEOUT_MS` chunks: the timer just
 * re-evaluates + re-arms rather than firing the refresh.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** One schedulable refresh — a workflow paired with one env + that env's
 *  cache row (if any). */
interface LiveEntry {
  workspaceId: string;
  workflow: LiveWorkflow;
  boundVariables: LiveVariable[];
  cache: WorkflowRunCache | null;
  environmentId: string | null;
}

// ── Module state ──────────────────────────────────────────────────

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Keys whose refresh is mid-flight — reconcile must not re-arm them. */
const inFlight = new Set<string>();
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let unsubscribers: Array<() => void> = [];

/** Stable in-memory key for a `(workspace, workflow, env)` triple. JSON
 *  round-trips the `null` env unambiguously; the map is never persisted
 *  so no compact codec is needed. */
function entryKey(workspaceId: string, workflowUid: string, environmentId: string | null): string {
  return JSON.stringify([workspaceId, workflowUid, environmentId]);
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

// ── Timer arming ──────────────────────────────────────────────────

function cancel(workspaceId: string, workflowUid: string, environmentId: string | null): void {
  const key = entryKey(workspaceId, workflowUid, environmentId);
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }
}

function armTimer(workspaceId: string, workflowUid: string, environmentId: string | null, delayMs: number): void {
  const key = entryKey(workspaceId, workflowUid, environmentId);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  if (delayMs > MAX_TIMEOUT_MS) {
    // Beyond the timer horizon — wake in a chunk and re-evaluate; the
    // re-schedule arms the remaining delay (or fires if it has elapsed).
    const t = setTimeout(() => {
      timers.delete(key);
      void rescheduleFromStore(workspaceId, workflowUid, environmentId);
    }, MAX_TIMEOUT_MS);
    timers.set(key, t);
    return;
  }

  const t = setTimeout(
    () => {
      void fire(workspaceId, workflowUid, environmentId);
    },
    Math.max(0, delayMs),
  );
  timers.set(key, t);
}

/** Arm (or clear) the timer for one entry against the current cadence. */
function scheduleEntry(entry: LiveEntry, now: number): void {
  const { workspaceId, workflow, boundVariables, cache, environmentId } = entry;
  if (!canScheduleWorkflow(workflow, boundVariables)) {
    cancel(workspaceId, workflow.uid, environmentId);
    return;
  }
  const nextAt = computeNextFireAt(workflow, toCacheSummary(cache), now);
  if (nextAt == null) {
    // Manual policy / unreadable expiry capture — no auto-refresh.
    cancel(workspaceId, workflow.uid, environmentId);
    return;
  }
  armTimer(workspaceId, workflow.uid, environmentId, nextAt - now);
}

/** Re-read one `(workflow, env)` from the stores and re-arm its timer. */
async function rescheduleFromStore(
  workspaceId: string,
  workflowUid: string,
  environmentId: string | null,
): Promise<void> {
  const workflow = getLiveWorkflowInWorkspace(workflowUid, workspaceId);
  if (!workflow) {
    cancel(workspaceId, workflowUid, environmentId);
    return;
  }
  const boundVariables = getLiveVariablesForWorkflowInWorkspace(workflowUid, workspaceId);
  const runs = await listCachesForWorkflow(workflowUid, workspaceId);
  const cache = runs.find((r) => r.environmentId === environmentId) ?? null;
  scheduleEntry({ workspaceId, workflow, boundVariables, cache, environmentId }, Date.now());
}

// ── Fire ──────────────────────────────────────────────────────────

async function fire(workspaceId: string, workflowUid: string, environmentId: string | null): Promise<void> {
  const key = entryKey(workspaceId, workflowUid, environmentId);
  timers.delete(key);
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    const workflow = getLiveWorkflowInWorkspace(workflowUid, workspaceId);
    if (!workflow) return;
    const boundVariables = getLiveVariablesForWorkflowInWorkspace(workflowUid, workspaceId);
    if (!canScheduleWorkflow(workflow, boundVariables)) return;

    const runs = await listCachesForWorkflow(workflowUid, workspaceId);
    const cache = runs.find((r) => r.environmentId === environmentId) ?? null;
    const now = Date.now();
    const circuit = cache?.circuit ?? null;

    // Circuit-aware gate — OPEN and before `nextAttemptAt` → skip this
    // fire (the `finally` re-arm lines the next attempt up with the
    // backoff window). Mirrors the extension provider's dispatch gate.
    if (circuit && !canCircuitAttempt(circuit, now)) return;
    // Persist OPEN → half-open before the probe so the failure path lands
    // on the half-open branch (bumping the backoff curve). No-op for
    // closed / already-half-open states.
    if (circuit?.state === 'open') {
      await markProbeStartForRun(workflowUid, environmentId, now, workspaceId);
    }

    // The runner owns the cache write (success → captures; failure →
    // recorded error) and only throws on an unexpected fault, caught
    // below. A per-fire success log would be pure noise on an always-on
    // host, so we don't emit one.
    await runDesktopWorkflowRefresh({ workspaceId, workflow, environmentId });
  } catch (err) {
    // An unexpected store/engine fault (an ordinary refresh failure is
    // recorded by the runner, not thrown). Don't let it kill the timer
    // loop — log and re-arm below.
    logger.warn(LOG, `Unexpected refresh fault for ${workflowUid}: ${(err as Error).message}`);
  } finally {
    inFlight.delete(key);
    // Re-arm off the post-write cache (success → next cadence; failure →
    // backoff; circuit-blocked → nextAttemptAt). The cache write also
    // fans an `onLiveCacheStoreChange` → reconcile, but that pass is
    // debounced and skips in-flight keys, so re-arming here is what
    // guarantees the next fire.
    await rescheduleFromStore(workspaceId, workflowUid, environmentId).catch((e) =>
      logger.warn(LOG, `re-arm after fire failed for ${workflowUid}: ${(e as Error).message}`),
    );
  }
}

// ── Reconcile ─────────────────────────────────────────────────────

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

/** Arm every schedulable entry, cancel timers no longer wanted. */
async function reconcile(): Promise<void> {
  const now = Date.now();
  const entries = await collectEntries();
  const desired = new Set<string>();
  for (const entry of entries) {
    const key = entryKey(entry.workspaceId, entry.workflow.uid, entry.environmentId);
    desired.add(key);
    // Don't disturb a refresh that's mid-flight — its `finally` re-arms.
    if (inFlight.has(key)) continue;
    scheduleEntry(entry, now);
  }
  // Orphan sweep — workflows deleted / disabled / unbound, env rows that
  // vanished, or the whole set after a workspace switch.
  for (const key of [...timers.keys()]) {
    if (desired.has(key)) continue;
    const t = timers.get(key);
    if (t) clearTimeout(t);
    timers.delete(key);
  }

  // Refresh the live pill off the same pass. The status output is a pure
  // function of the active-workspace cache rows, which change on exactly
  // the events that drive reconcile (a fire's cache write, a delete, a
  // workspace switch's re-hydration), so folding it in here reuses this
  // debounced trigger rather than adding a second subscription + timer.
  await recomputeDesktopLiveStatus().catch((e) =>
    logger.warn(LOG, `live status recompute failed: ${(e as Error).message}`),
  );
}

function scheduleReconcile(): void {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    void reconcile().catch((e) => logger.warn(LOG, `reconcile failed: ${(e as Error).message}`));
  }, RECONCILE_DEBOUNCE_MS);
}

// ── Lifecycle ─────────────────────────────────────────────────────

/**
 * Start the desktop live runner. Subscribes to the host-neutral store
 * events that drive reconciliation and primes one reconcile from the
 * already-hydrated stores. Idempotent — a second call is a no-op.
 */
export function startDesktopLiveRunner(): void {
  if (started) return;
  started = true;
  unsubscribers = [
    onLiveWorkflowStoreChange(scheduleReconcile),
    onLiveVariableStoreChange(scheduleReconcile),
    onLiveCacheStoreChange(() => scheduleReconcile()),
    onEnvironmentStoreChange(scheduleReconcile),
    onRequestStoreChange(scheduleReconcile),
    onWorkspaceStoreChange(scheduleReconcile),
  ];
  // The host-neutral definitional-freshness detectors (LF1–LF4) own
  // their own store subscriptions; the only host-specific seam is
  // `refreshNow` — the desktop's gated `fire`, so an edit-triggered
  // active-env refresh carries the same circuit handling + cache-write
  // discipline as a cadence fire. Now that the desktop is a value
  // PRODUCER for deferring peers (C6+), it must self-correct a
  // wrong-recipe value on edit rather than propagating it until the
  // next cadence tick.
  startDefinitionalFreshness({
    refreshNow: (workspaceId, workflowUid, environmentId) => fire(workspaceId, workflowUid, environmentId),
  });
  void reconcile().catch((e) => logger.warn(LOG, `initial reconcile failed: ${(e as Error).message}`));
}

/** Tear down all timers + subscriptions (called on `before-quit`). */
export function stopDesktopLiveRunner(): void {
  if (!started) return;
  started = false;
  stopDefinitionalFreshness();
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  if (reconcileTimer) {
    clearTimeout(reconcileTimer);
    reconcileTimer = null;
  }
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  inFlight.clear();
}
