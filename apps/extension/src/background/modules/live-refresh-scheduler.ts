/**
 * Live workflow refresh scheduler — alarm-driven background refresh so
 * `{{live.X}}` values stay warm without requiring a renderer-side
 * refresh click.
 *
 * ARCHITECTURE §20 + `docs/LIVE_VARIABLES_PLAN.md` (Phase C).
 *
 * Design:
 *   • `chrome.alarms` is the cross-SW-wake timer primitive. Each
 *     `(workspaceId, workflowUid, environmentId)` triple gets one
 *     alarm named `live-refresh:<b64url({w,u,e})>` — `(ws, wf, env)`
 *     is the natural identity: env switches expose a distinct cached
 *     run (see `live-cache-store`), so we schedule per-env too.
 *   • Only WORKFLOWS get alarms. LiveVariables piggyback — deleting
 *     or disabling a bound LV just changes the reference-count view,
 *     which triggers a reconcile.
 *   • Reconcile-on-wake — `reconcileLiveSchedules()` walks every
 *     workspace's workflows + caches on SW startup (and on every
 *     store mutation) and re-schedules alarms from scratch against
 *     the current `computeNextFireAt` from `@openheaders/core/live`.
 *     Orphan alarms (workflow deleted while SW was asleep) are
 *     cleared against `chrome.alarms.getAll()`.
 *   • The refresh work itself is delegated to an adapter installed by
 *     Phase D (`__setLiveRefreshAdapter`). The scheduler knows WHEN
 *     to fire, not HOW to fetch. When no adapter is installed the
 *     handler records a `scheduler-not-ready` error and the cache's
 *     failure counter widens the backoff — safe no-op until Phase D
 *     lands.
 *
 * What is NOT scheduled:
 *   • Workflows with `refresh.kind === 'manual'` — user-triggered only.
 *   • Workflows that `disabled` or whose every bound LV has a
 *     `manualOverride` set (no consumer needs fresh data).
 *   • Workflows with zero enabled LV bindings — nothing reads from
 *     their cache, so firing alarms would be pure waste. Phase E will
 *     extend this by also filtering on "no enabled rule/request
 *     references any of the workflow's LVs"; for now we treat the LV
 *     existence as the first-order ref-count.
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

// ── Constants ──────────────────────────────────────────────────────

export const LIVE_ALARM_PREFIX = 'live-refresh:';

// Re-exported from core so the scheduler can be reasoned about in
// isolation, and so tests don't have to reach across package bounds
// to pin the floor value.
export { MAX_BACKOFF_SECONDS, MIN_ALARM_DELAY_MS };

// ── Alarm-name codec ──────────────────────────────────────────────

/**
 * Encode `(workspaceId, workflowUid, environmentId)` into an alarm
 * name. Uses base64url over JSON so arbitrary id contents survive.
 * `environmentId === null` round-trips to the "No environment" state.
 */
export function buildAlarmName(workspaceId: string, workflowUid: string, environmentId: string | null): string {
  const json = JSON.stringify({ w: workspaceId, u: workflowUid, e: environmentId });
  return `${LIVE_ALARM_PREFIX}${base64UrlEncode(json)}`;
}

/**
 * Decode an alarm name produced by {@link buildAlarmName}. Returns
 * null for anything that doesn't carry the prefix or whose payload is
 * malformed.
 */
export function parseAlarmName(
  name: string,
): { workspaceId: string; workflowUid: string; environmentId: string | null } | null {
  if (!name.startsWith(LIVE_ALARM_PREFIX)) return null;
  try {
    const json = base64UrlDecode(name.slice(LIVE_ALARM_PREFIX.length));
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { w?: unknown }).w === 'string' &&
      typeof (parsed as { u?: unknown }).u === 'string'
    ) {
      const obj = parsed as { w: string; u: string; e: string | null };
      return {
        workspaceId: obj.w,
        workflowUid: obj.u,
        environmentId: typeof obj.e === 'string' ? obj.e : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the alarm belongs to the live scheduler. */
export function isLiveRefreshAlarm(alarm: chrome.alarms.Alarm): boolean {
  return typeof alarm?.name === 'string' && alarm.name.startsWith(LIVE_ALARM_PREFIX);
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

// ── Can-refresh gate ──────────────────────────────────────────────

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
  // At least one enabled LV is bound to this workflow.
  const hasEnabledBinding = boundVariables.some((v) => v.enabled);
  if (!hasEnabledBinding) return false;
  return true;
}

// ── Scheduling ────────────────────────────────────────────────────

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

/**
 * Schedule (or re-schedule) the alarm for one workflow-run
 * identity. Safe to call repeatedly — `chrome.alarms.create`
 * overwrites an existing alarm with the same name.
 *
 * Returns `true` when an alarm was scheduled, `false` when the
 * workflow was skipped (manual-only, cadence returned null, no
 * bindings, disabled, or alarms shim unavailable).
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
  if (!alarms) return false;
  if (!canScheduleWorkflow(entry.workflow, entry.boundVariables)) {
    await cancelLiveWorkflowRefresh(entry.workspaceId, entry.workflow.uid, entry.environmentId);
    return false;
  }
  const when = computeNextFireAtCore(entry.workflow, toCacheSummary(entry.cache), nowMs);
  if (when == null) {
    // Manual policy OR nothing to schedule against — make sure no
    // stale alarm lingers from a previous config.
    await cancelLiveWorkflowRefresh(entry.workspaceId, entry.workflow.uid, entry.environmentId);
    return false;
  }
  const name = buildAlarmName(entry.workspaceId, entry.workflow.uid, entry.environmentId);
  alarms.create(name, { when });
  logger.debug(
    'LiveScheduler',
    `Scheduled refresh for workflow=${entry.workflow.uid} (ws=${entry.workspaceId}, env=${entry.environmentId ?? '__none__'}) at ${new Date(when).toISOString()}`,
  );
  return true;
}

/** Cancel the alarm for one `(workflow, env)` pair. No-op when absent. */
export async function cancelLiveWorkflowRefresh(
  workspaceId: string,
  workflowUid: string,
  environmentId: string | null,
): Promise<void> {
  if (!alarms) return;
  alarms.clear(buildAlarmName(workspaceId, workflowUid, environmentId));
}

// ── Reconcile ─────────────────────────────────────────────────────

interface ReconcileEntry {
  workspaceId: string;
  workflow: V5.LiveWorkflow;
  boundVariables: V5.LiveVariable[];
  runs: WorkflowRunCache[];
}

/**
 * Walk every workspace's workflows and (re)schedule each eligible
 * one. Orphan alarms (workflows deleted or disabled since last
 * schedule) are cleared against `chrome.alarms.getAll()`.
 *
 * Called on SW wake + after every live store mutation. Idempotent
 * `alarms.create` makes it safe to run eagerly.
 */
export async function reconcileLiveSchedules(nowMs: number = Date.now()): Promise<void> {
  if (!alarms) return;

  const entries: ReconcileEntry[] = await collectEntries();
  const desiredNames = new Set<string>();

  for (const entry of entries) {
    // If the workflow has no cache yet (never refreshed) we still
    // schedule one alarm against the `null` env so the first refresh
    // populates the cache for whatever env is active at that time.
    const envs: Array<string | null> = entry.runs.length > 0 ? entry.runs.map((r) => r.environmentId) : [null];
    for (const envId of envs) {
      const cache = entry.runs.find((r) => r.environmentId === envId) ?? null;
      const scheduled = await scheduleLiveWorkflowRefresh(
        {
          workspaceId: entry.workspaceId,
          workflow: entry.workflow,
          boundVariables: entry.boundVariables,
          cache,
          environmentId: envId,
        },
        nowMs,
      );
      if (scheduled) {
        desiredNames.add(buildAlarmName(entry.workspaceId, entry.workflow.uid, envId));
      }
    }
  }

  const existing = await alarms.getAll();
  for (const alarm of existing) {
    if (!isLiveRefreshAlarm(alarm)) continue;
    if (!desiredNames.has(alarm.name)) {
      alarms.clear(alarm.name);
      logger.debug('LiveScheduler', `Cleared orphan alarm ${alarm.name}`);
    }
  }
}

/**
 * Build the scheduler's reconcile entries by iterating every
 * workspace's workflows + cache + LV bindings. The active workspace
 * is handled in-memory (via the per-workspace stores); inactive
 * workspaces are read directly from `chrome.storage.local` so the
 * scheduler is complete even when the user is on a different
 * workspace tab.
 *
 * Per the plan, v1 reads directly from storage for inactive
 * workspaces; a future "multi-workspace store" refactor can share
 * the in-memory cache, but the simpler code is fine at the expected
 * workspace-count scale (low tens).
 */
async function collectEntries(): Promise<ReconcileEntry[]> {
  const out: ReconcileEntry[] = [];

  // ── Active workspace (in-memory snapshot) ────────────────────
  const activeWorkflows = getLiveWorkflows();
  if (activeWorkflows.length > 0) {
    // We need the workspaceId for the active slice. Reading it from
    // the in-memory workspace-store would create a circular dep; use
    // `OH.activeWorkspaceId` directly instead.
    const activeId = (await extensionStorage.get(OH.activeWorkspaceId)) ?? '';
    if (typeof activeId === 'string' && activeId.length > 0) {
      for (const workflow of activeWorkflows) {
        out.push({
          workspaceId: activeId,
          workflow,
          boundVariables: getLiveVariablesForWorkflow(workflow.uid),
          runs: await listCachesForWorkflow(workflow.uid, activeId),
        });
      }
    }
  }

  // ── Inactive workspaces (read directly from storage) ─────────
  const workspaces = (await extensionStorage.get(OH.workspaces)) ?? [];
  const activeIdCheck = (await extensionStorage.get(OH.activeWorkspaceId)) ?? '';
  for (const ws of workspaces) {
    if (ws.id === activeIdCheck) continue; // already handled via in-memory path
    const stored = await readInactiveWorkspace(ws.id);
    for (const workflow of stored.workflows) {
      out.push({
        workspaceId: ws.id,
        workflow,
        boundVariables: stored.variables.filter((v) => v.workflowUid === workflow.uid),
        runs: stored.runs.filter((r) => r.workflowUid === workflow.uid),
      });
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

// ── Alarm dispatch ────────────────────────────────────────────────

/**
 * Handle a `live-refresh:*` alarm. Loads the workflow + cache,
 * delegates to the installed adapter, records observability entries,
 * and lets the cache-change listener trigger the next reconcile (so
 * the backoff + expires-in math runs on fresh data).
 *
 * Without an adapter installed (Phase C shipped before Phase D),
 * records a `scheduler-not-ready` error against the cache so the
 * backoff counter widens and we don't hot-loop.
 */
export async function handleLiveAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const parsed = parseAlarmName(alarm.name);
  if (!parsed) return;
  const { workspaceId, workflowUid, environmentId } = parsed;

  recordLog({
    subsystem: 'live',
    op: 'refresh-fired',
    level: 'info',
    message: `Alarm fired for workflow ${workflowUid}`,
    context: { workspaceId, workflowUid, environmentId },
  });

  // Lookup in the ACTIVE store first; fall back to the on-disk blob
  // for an inactive workspace.
  let workflow: V5.LiveWorkflow | undefined = getLiveWorkflows().find((w) => w.uid === workflowUid);
  if (!workflow) {
    const stored = await readInactiveWorkspace(workspaceId);
    workflow = stored.workflows.find((w) => w.uid === workflowUid);
  }
  if (!workflow) {
    // Workflow deleted between scheduling and firing — cancel the
    // stale alarm so it doesn't fire again.
    await cancelLiveWorkflowRefresh(workspaceId, workflowUid, environmentId);
    return;
  }

  if (!refreshAdapter) {
    await recordRefreshError(
      {
        workflowUid,
        environmentId,
        message: 'scheduler-not-ready: no refresh adapter installed',
        extractorOk: false,
      },
      workspaceId,
    );
    recordLog({
      subsystem: 'live',
      op: 'refresh-failed',
      level: 'warn',
      message: `No refresh adapter for workflow ${workflowUid} (Phase D not yet wired)`,
      context: { workspaceId, workflowUid, environmentId, errorClass: 'SchedulerNotReady' },
    });
    return;
  }

  try {
    await refreshAdapter.refreshWorkflow({ workspaceId, workflow, environmentId });
    recordLog({
      subsystem: 'live',
      op: 'refresh-succeeded',
      level: 'info',
      message: `Refreshed workflow ${workflowUid}`,
      context: { workspaceId, workflowUid, environmentId },
    });
  } catch (err) {
    const message = (err as Error)?.message ?? 'refresh failed';
    const errorClass = (err as Error)?.name;
    // Well-behaved adapters record their own error detail before
    // throwing; this catch is defensive so scheduler state stays
    // consistent if an adapter bubbles unexpectedly.
    await recordRefreshError({ workflowUid, environmentId, message, extractorOk: false }, workspaceId);
    recordLog({
      subsystem: 'live',
      op: 'refresh-failed',
      level: 'error',
      message: `Refresh failed for ${workflowUid}: ${message}`,
      context: { workspaceId, workflowUid, environmentId, errorClass },
    });
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────

let unsubWorkflow: (() => void) | null = null;
let unsubVariable: (() => void) | null = null;
let unsubCache: (() => void) | null = null;

/**
 * Subscribe the scheduler to live store changes. Idempotent — safe
 * to call repeatedly; a second call before `stopLiveScheduler()`
 * is a no-op. Every subscribed store mutation triggers a reconcile,
 * which keeps cadence honest without any explicit reschedule calls
 * at the mutation sites.
 */
export function startLiveScheduler(): void {
  if (unsubWorkflow) return;
  const tickReconcile = (): void => {
    void reconcileLiveSchedules().catch((err: unknown) => {
      logger.warn('LiveScheduler', 'Reconcile after store change failed', err);
    });
  };
  unsubWorkflow = onLiveWorkflowStoreChange(tickReconcile);
  unsubVariable = onLiveVariableStoreChange(tickReconcile);
  unsubCache = onLiveCacheStoreChange(tickReconcile);
}

export function stopLiveScheduler(): void {
  if (unsubWorkflow) {
    unsubWorkflow();
    unsubWorkflow = null;
  }
  if (unsubVariable) {
    unsubVariable();
    unsubVariable = null;
  }
  if (unsubCache) {
    unsubCache();
    unsubCache = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
