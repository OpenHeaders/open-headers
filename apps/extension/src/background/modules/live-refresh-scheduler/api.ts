/**
 * Public API + lifecycle — the scheduler instance over the shared
 * `RefreshScheduler` core, the exported schedule/cancel/reconcile/
 * dispatch/manual-refresh entry points (each bracketed by the
 * workspace-resident guard), and start/stop wiring incl. the
 * switch-warm subscriptions.
 */

import {
  canAttempt as canCircuitAttempt,
  computeNextFireAt as computeNextFireAtCore,
  isLiveVariableEffective,
  MIN_ALARM_DELAY_MS,
} from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { getActiveEnvironmentId, onActiveEnvironmentChange } from '@openheaders/oracle/entity/environment-store';
import { startDefinitionalFreshness, stopDefinitionalFreshness } from '@openheaders/oracle/live/definitional-freshness';
import {
  listCachesForWorkflow,
  markProbeStartForRun,
  resetCircuitForRun,
  type WorkflowRunCache,
} from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariables, getLiveVariablesForWorkflow } from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflows } from '@openheaders/oracle/live/live-workflow-store';
import { canScheduleWorkflow } from '@openheaders/oracle/live/scheduling-gate';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { createAlarmsRefreshTimer, RefreshScheduler } from '../refresh-scheduler';
import { getActiveWorkspaceId, onActiveWorkspaceChange } from '../workspace-store';
import { refreshAdapter } from './adapter';
import { buildAlarmName, codec, type LiveAlarmPayload } from './codec';
import { toCacheSummary } from './entries';
import { isNetworkOnline, LiveSchedulerNotReadyError } from './errors';
import { provider } from './provider';
import { recomputeLiveStatus } from './status';

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

const scheduler = new RefreshScheduler(provider, 'LiveScheduler', createAlarmsRefreshTimer());

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
 * Handle a `live-refresh:*` alarm. Delegates to the shared scheduler
 * core, which decodes + loads + gates + delegates to the adapter +
 * routes observability + records failure + re-arms. Brackets the
 * dispatch with a workspace-service refcount so a workspace whose
 * lifeline-driven refcount dropped between alarm scheduling and alarm
 * fire (typical MV3 SW-eviction or a closed workbench tab)
 * re-materializes for the duration of the operation rather than
 * failing with "workflow not found in workspace".
 */
export async function handleLiveAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const decoded = codec.decode(alarm.name);
  if (!decoded) return scheduler.handleFire(alarm.name);
  return withWorkspaceResident(decoded.w, () => scheduler.handleFire(alarm.name));
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
    scheduler.handleFire(buildAlarmName(workspaceId, workflowUid, environmentId)),
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
  const job = await provider.getByKey(payload);
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
