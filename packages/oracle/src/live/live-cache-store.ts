/**
 * Live Cache Store — per-workspace cache of workflow-run extractions
 * (see `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * One blob per workspace at `oh.ws.<id>.liveCache`, shaped as:
 *
 *   {
 *     schemaVersion: 5,
 *     version: number,                       // monotonic blob-write counter
 *     runs: Record<string, WorkflowRunCache> // keyed by `${workflowUid}:${envKey}`
 *   }
 *
 * where `envKey = environmentId ?? '__none__'` — the cache is keyed by
 * the active environment at extraction time so switching envs exposes
 * independent cached values per env without a migration.
 *
 * Writes serialize through `withLock(entityLockName(ws, 'live-cache',
 * 'singleton'))` — a single writer per workspace, no lost updates
 * when two tabs fire a manual refresh concurrently. Reads are lock-
 * free; `chrome.storage.local` gives atomic snapshot semantics.
 *
 * Storage semantics:
 *   - `putWorkflowRunCache` on successful refresh writes the new
 *     captures + clears any accumulated failure state.
 *   - `recordRefreshError` on failure increments the consecutive-
 *     failure counter, sets `lastErrorAt/Message/StepId`, and
 *     preserves the previous captures verbatim (atomic-refresh
 *     discipline — a broken refresh never downgrades the last-good
 *     cache).
 *   - `clearWorkflowRunCache` wipes every env-keyed entry for a
 *     workflow. Called when the workflow definition is deleted.
 *   - `markWorkflowDefinitionallyStale` flags every env-keyed entry
 *     for a workflow as wrong-recipe (a material edit landed) without
 *     re-extracting. Used for manual-trigger workflows, which must not
 *     auto-run; a later successful `putWorkflowRunCache` clears it.
 *
 * This store does NOT perform the refresh itself. The chain runner
 * (Phase D) calls the store's write methods after executing a
 * workflow's steps; the scheduler (Phase C) reads the cache to
 * decide when to fire.
 */

import {
  type CircuitSnapshot,
  initialCircuitSnapshot,
  onCircuitFailure,
  onCircuitSuccess,
  resetCircuit as resetCircuitSnapshot,
  transitionOpenToHalfOpen,
} from '@openheaders/core/live';
import type { LiveValueRecord, WorkflowRunCache } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { hostStorage, OH, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

export type { WorkflowRunCache } from '@openheaders/core/types';

interface LiveCacheBlob {
  schemaVersion: number;
  version: number;
  runs: Record<string, WorkflowRunCache>;
}

const DEFAULT_BLOB: LiveCacheBlob = { schemaVersion: 5, version: 1, runs: {} };

function normalizeBlob(raw: unknown): LiveCacheBlob {
  if (!raw || typeof raw !== 'object') return DEFAULT_BLOB;
  const blob = raw as Partial<LiveCacheBlob>;
  if (
    typeof blob.schemaVersion !== 'number' ||
    typeof blob.version !== 'number' ||
    !blob.runs ||
    typeof blob.runs !== 'object'
  ) {
    return DEFAULT_BLOB;
  }
  // Per-row tolerant read: inject a default circuit snapshot into any
  // row that predates the circuit-breaker field. This is the ONLY
  // backwards-compat we do — this is pre-release so there's no migration
  // story, but within a single SW lifetime a read could still encounter
  // a storage row written before this module shipped. Safer to heal on
  // read than to crash a scheduler dispatch on `cache.circuit.state`.
  const rawRuns = blob.runs as Record<string, Partial<WorkflowRunCache>>;
  const runs: Record<string, WorkflowRunCache> = {};
  for (const [key, row] of Object.entries(rawRuns)) {
    if (!row || typeof row !== 'object') continue;
    runs[key] = {
      ...(row as WorkflowRunCache),
      circuit: row.circuit ?? initialCircuitSnapshot(),
    };
  }
  return {
    schemaVersion: blob.schemaVersion,
    version: blob.version,
    runs,
  };
}

// ── Env-key helper ─────────────────────────────────────────────────

const NO_ENV_KEY = '__none__';

function envKey(environmentId: string | null): string {
  return environmentId ?? NO_ENV_KEY;
}

function runKey(workflowUid: string, environmentId: string | null): string {
  return `${workflowUid}:${envKey(environmentId)}`;
}

// ── IO ─────────────────────────────────────────────────────────────

async function readBlob(workspaceId: string): Promise<LiveCacheBlob> {
  const raw = await hostStorage.get(wsKeys(workspaceId).liveCache);
  return normalizeBlob(raw);
}

async function writeBlob(workspaceId: string, blob: LiveCacheBlob): Promise<void> {
  await hostStorage.set(wsKeys(workspaceId).liveCache, blob);
}

function resolveWorkspaceId(workspaceId: string | undefined): string {
  return workspaceId ?? requireActiveWorkspaceId();
}

function withCacheLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'live-cache', 'singleton'), fn, { op: 'live-cache-mutate' });
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

// ── Change listeners ────────────────────────────────────────────────

/**
 * Listeners receive `(workspaceId, workflowUid, runs)` so subscribers
 * can update their own mirrors synchronously from the `runs` snapshot
 * instead of racing an async re-read of `chrome.storage.local`.
 *
 * - `workflowUid === null` signals a full-workspace mutation
 *   (workspace purge, bulk clear).
 * - `runs` is the complete post-write run list for the workspace;
 *   subscribers that only care about a subset (e.g. the resolver's
 *   active-workspace mirror) should filter by `workspaceId`.
 *
 * The earlier signature omitted `runs`, forcing the resolver's mirror
 * to refresh via a separate async `listWorkflowRunCaches` call. That
 * kicked off in parallel with the background listener's DNR rebuild,
 * and the rebuild usually won the race — so a freshly-cached capture
 * would reach the UI via broadcast while DNR kept shipping the
 * previous value.
 */
type ChangeListener = (workspaceId: string, workflowUid: string | null, runs: readonly WorkflowRunCache[]) => void;
const listeners: Set<ChangeListener> = new Set();

export function onLiveCacheStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(workspaceId: string, workflowUid: string | null, runs: readonly WorkflowRunCache[]): void {
  for (const fn of listeners) fn(workspaceId, workflowUid, runs);
}

// ── §4 value propagation hooks (WS-C C6) ────────────────────────────

/**
 * The value subset of one cache row, projected for §4 propagation.
 * Carries only what crosses the wire — `circuit` / failure counters /
 * response bytes / definitional-staleness are host-local bookkeeping
 * and never travel.
 */
export type LiveValuePropagator = (input: { runKey: string; value: LiveValueRecord }, workspaceId: string) => void;
export type LiveValueRemover = (runKeys: readonly string[], workspaceId: string) => void;

let propagator: LiveValuePropagator | null = null;
let remover: LiveValueRemover | null = null;

/**
 * Register the §4 value-propagation sink. Wired once at boot by
 * `live-value-store.ts` (the sync-engine bridge). Until then — and on
 * hosts that never connect a backend — the cache is a pure host-local
 * store and these are no-ops. Inverting the dependency this way keeps
 * `live-cache-store` free of any `@openheaders/oracle/sync` import cycle:
 * the sync side reaches IN, the cache never reaches OUT.
 */
export function setLiveValuePropagator(fn: LiveValuePropagator | null): void {
  propagator = fn;
}

export function setLiveValueRemover(fn: LiveValueRemover | null): void {
  remover = fn;
}

/**
 * Overlay a synced value subset onto the host-local cache blob — the
 * receive side of §4 value propagation. For each run-key the value
 * fields (`stepCaptures` / `extractedAt` / `expiresAt`) are merged onto
 * the existing row, **preserving that host's own runner bookkeeping**
 * (circuit / failures / response bytes / definitional-staleness); a
 * run-key with no existing row is created with default bookkeeping. Rows
 * absent from `values` are left untouched — deletion is the
 * delete-cascade's job, not this additive merge.
 *
 * Each merged row is stamped `lastSyncedValueAt` (the WS-C C8 cadence-
 * ownership marker) so a connected peer knows the value is remote-sourced
 * and can defer its own cadence to the backend.
 *
 * No-ops (no write, no notify) when nothing actually changed, which is
 * what makes the producer's own apply-echo cheap: the value it just
 * wrote via {@link putWorkflowRunCache} is already identical here.
 */
export async function applySyncedLiveValues(
  workspaceId: string,
  values: Record<string, LiveValueRecord>,
): Promise<void> {
  let changed = false;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(workspaceId, async () => {
    const current = await readBlob(workspaceId);
    const nextRuns: Record<string, WorkflowRunCache> = { ...current.runs };
    // Wall-clock of this merge — stamped onto every row a genuinely-
    // different remote value lands on, as the WS-C C8 cadence-ownership
    // marker. The producer's own echo hits the `continue` skip below, so
    // a host never marks its own production remote-sourced.
    const mergedAt = Date.now();
    for (const [key, value] of Object.entries(values)) {
      const previous = current.runs[key];
      if (
        previous &&
        previous.extractedAt === value.extractedAt &&
        previous.expiresAt === value.expiresAt &&
        sameCaptures(previous.stepCaptures, value.stepCaptures)
      ) {
        continue; // identical value — skip (producer echo / re-seed)
      }
      changed = true;
      nextRuns[key] = previous
        ? {
            ...previous,
            stepCaptures: value.stepCaptures,
            extractedAt: value.extractedAt,
            expiresAt: value.expiresAt,
            lastSyncedValueAt: mergedAt,
            // A fresh remote value is the backend coming back to life —
            // clear any C9 exclusive-degraded mark so the pill drops out
            // of "reconnect the desktop" the instant the value lands.
            exclusiveDegradedSince: undefined,
          }
        : {
            workflowUid: value.workflowUid,
            environmentId: value.environmentId,
            stepCaptures: value.stepCaptures,
            stepResponseBytes: {},
            extractedAt: value.extractedAt,
            expiresAt: value.expiresAt,
            consecutiveFailures: 0,
            lastExtractorOk: true,
            circuit: initialCircuitSnapshot(),
            lastSyncedValueAt: mergedAt,
          };
    }
    if (!changed) return;
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(workspaceId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (changed) notifyChange(workspaceId, null, postWriteRuns);
}

function sameCaptures(
  a: Record<string, Record<string, string>>,
  b: Record<string, Record<string, string>>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const stepId of aKeys) {
    const aStep = a[stepId];
    const bStep = b[stepId];
    if (!bStep) return false;
    const aCapKeys = Object.keys(aStep);
    if (aCapKeys.length !== Object.keys(bStep).length) return false;
    for (const cap of aCapKeys) {
      if (aStep[cap] !== bStep[cap]) return false;
    }
  }
  return true;
}

// ── Reads ──────────────────────────────────────────────────────────

export async function getWorkflowRunCache(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return blob.runs[runKey(workflowUid, environmentId)] ?? null;
}

/**
 * Snapshot every cached workflow run for a workspace. Used by:
 *   - Phase C scheduler — iterate overdue caches on SW wake.
 *   - Phase E resolver — build the `LiveRegistry` passed to
 *     `VariableResolver.setLiveRegistry`.
 *
 * Returns the raw `runs` map (cheap pass-through — the caller may
 * mutate freely; the in-memory blob is re-read on every call).
 */
export async function listWorkflowRunCaches(workspaceId?: string): Promise<WorkflowRunCache[]> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return Object.values(blob.runs);
}

/** Every cached run for one workflow (all env-keyed entries). */
export async function listCachesForWorkflow(workflowUid: string, workspaceId?: string): Promise<WorkflowRunCache[]> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return Object.values(blob.runs).filter((r) => r.workflowUid === workflowUid);
}

// ── Writes ─────────────────────────────────────────────────────────

export interface SuccessfulRunInput {
  workflowUid: string;
  environmentId: string | null;
  stepCaptures: Record<string, Record<string, string>>;
  stepResponseBytes: Record<string, number>;
  extractedAt: number;
  expiresAt: number | null;
}

/**
 * Atomically write a successful workflow-run extraction. Clears any
 * accumulated failure state — a successful refresh resets the
 * backoff counter AND applies `onCircuitSuccess` to the persisted
 * circuit snapshot so the state machine closes the breaker (with
 * decay of `consecutiveOpenings` where appropriate). Fires
 * `onLiveCacheStoreChange` with the post-write snapshot.
 */
export async function putWorkflowRunCache(input: SuccessfulRunInput, workspaceId?: string): Promise<WorkflowRunCache> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  let entry!: WorkflowRunCache;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    const priorCircuit = previous?.circuit ?? initialCircuitSnapshot();
    const nextCircuit = onCircuitSuccess(priorCircuit, input.extractedAt);
    entry = {
      workflowUid: input.workflowUid,
      environmentId: input.environmentId,
      stepCaptures: input.stepCaptures,
      stepResponseBytes: input.stepResponseBytes,
      extractedAt: input.extractedAt,
      expiresAt: input.expiresAt,
      consecutiveFailures: 0,
      lastExtractorOk: true,
      circuit: nextCircuit,
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: entry },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    logger.debug(
      'LiveCacheStore',
      `Stored run for ${input.workflowUid} (env=${envKey(input.environmentId)}, ws=${wsId})`,
    );
  });
  notifyChange(wsId, input.workflowUid, postWriteRuns);
  // §4 value propagation (WS-C C6): the local blob write above is this
  // host's own materialization; the propagator (when a backend bridge
  // is wired) additionally commits the value subset through the oracle
  // so it rides §4 to paired peers. Host-local bookkeeping never leaves.
  propagator?.(
    {
      runKey: key,
      value: {
        workflowUid: input.workflowUid,
        environmentId: input.environmentId,
        stepCaptures: input.stepCaptures,
        extractedAt: input.extractedAt,
        expiresAt: input.expiresAt,
      },
    },
    wsId,
  );
  return entry;
}

export interface RefreshErrorInput {
  workflowUid: string;
  environmentId: string | null;
  message: string;
  failedStepId?: string;
  /**
   * `false` when the step fetches succeeded but extractor(s) failed.
   * Preserves the cached captures — the response was real.
   */
  extractorOk?: boolean;
}

/**
 * Record a failed refresh. Preserves the previous captures (atomic-
 * refresh discipline) and advances the circuit snapshot via
 * `onCircuitFailure` — same call whether the circuit is currently
 * CLOSED (pre-breaker tier), HALF-OPEN (probe failed → re-open), or
 * OPEN (manual-bypass failure → refresh `nextAttemptAt`). The
 * scheduler reads `circuit.nextAttemptAt` / `consecutiveFailures` to
 * compute the next alarm.
 */
export async function recordRefreshError(input: RefreshErrorInput, workspaceId?: string): Promise<WorkflowRunCache> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  const now = Date.now();
  let latest: WorkflowRunCache;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    const priorCircuit = previous?.circuit ?? initialCircuitSnapshot();
    const nextCircuit = onCircuitFailure(priorCircuit, now);
    latest = {
      workflowUid: input.workflowUid,
      environmentId: input.environmentId,
      stepCaptures: previous?.stepCaptures ?? {},
      stepResponseBytes: previous?.stepResponseBytes ?? {},
      extractedAt: previous?.extractedAt ?? 0,
      expiresAt: previous?.expiresAt ?? null,
      consecutiveFailures: nextCircuit.consecutiveFailures,
      lastErrorAt: now,
      lastErrorMessage: truncate(input.message, 200),
      lastErrorStepId: input.failedStepId,
      lastExtractorOk: input.extractorOk ?? false,
      circuit: nextCircuit,
      // A failed refresh did NOT re-extract the value, so a definitional-
      // staleness flag must survive — only a successful `putWorkflowRun
      // Cache` clears it.
      definitionallyStale: previous?.definitionallyStale,
      // A failed *own* refresh doesn't erase the fact that a remote value
      // recently arrived — a connected peer should keep deferring to the
      // backend rather than treat its own failure as taking over (C8).
      lastSyncedValueAt: previous?.lastSyncedValueAt,
      // Likewise a failed own refresh doesn't mean the backend is back —
      // preserve the C9 exclusive-degraded mark until a genuinely fresh
      // remote value (or an own success) clears it.
      exclusiveDegradedSince: previous?.exclusiveDegradedSince,
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  notifyChange(wsId, input.workflowUid, postWriteRuns);
  return latest!;
}

/**
 * Transition the circuit `open → half-open` in persisted state at
 * the moment a probe attempt is about to dispatch. Called from the
 * scheduler's alarm path AFTER `canAttempt` says yes and BEFORE the
 * adapter runs the chain. Idempotent — no-op when state isn't
 * `open` or when `nextAttemptAt` hasn't been reached yet.
 *
 * Why persist before the probe: `onCircuitFailure` has different
 * semantics for `half-open` (bump openings) vs `open` (preserve
 * openings — that branch is for manual-bypass failures). If we
 * didn't transition first, a failed scheduled probe would take the
 * open-branch and not grow the backoff curve across repeated
 * outages. Writing through the cache store means the UI's "probing..."
 * state lights up immediately too.
 */
export async function markProbeStartForRun(
  workflowUid: string,
  environmentId: string | null,
  nowMs: number = Date.now(),
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous) return;
    const transitioned = transitionOpenToHalfOpen(previous.circuit, nowMs);
    if (transitioned === previous.circuit) return; // no-op
    latest = { ...previous, circuit: transitioned };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, workflowUid, postWriteRuns);
  return latest;
}

/**
 * Mark a run's *exclusive* credential as degraded because a connected peer
 * declined to self-refresh it at the near-expiry escape hatch (WS-C C9) —
 * the backend that was producing this remote-sourced value went silent and
 * a self-refresh would burn the single-use code / trip OAuth reuse-detection.
 *
 * Idempotent: once marked, a re-mark is a no-op (preserves the original
 * `since` and avoids notify churn on the steady-state re-check poll). No
 * row → null (nothing to degrade). The mark is cleared by a fresh remote
 * value (`applySyncedLiveValues`) or this host producing the value itself
 * (`putWorkflowRunCache` writes a row without the field).
 */
export async function markExclusiveDegradedForRun(
  workflowUid: string,
  environmentId: string | null,
  sinceMs: number = Date.now(),
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous || previous.exclusiveDegradedSince != null) return; // absent or already degraded
    latest = { ...previous, exclusiveDegradedSince: sinceMs };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, workflowUid, postWriteRuns);
  return latest;
}

/**
 * Record a failure from a manual-bypass attempt. Unlike
 * {@link recordRefreshError}, this path does NOT advance the circuit
 * state machine — `nextAttemptAt`, `consecutiveOpenings`, and
 * `consecutiveFailures` all stay at their pre-bypass values. The
 * only things written are the error-detail fields (`lastErrorAt`,
 * `lastErrorMessage`, `lastErrorStepId`) + `lastExtractorOk`.
 *
 * Rationale matches v4 `AdaptiveCircuitBreaker.executeWithBypass`:
 * a user clicking "Retry now" while the circuit is paused is not a
 * natural retry tick. If it fails, the provider is still broken;
 * the existing backoff curve is already the right answer — pushing
 * `nextAttemptAt` forward would punish the user for their clarifying
 * click.
 */
export async function recordManualBypassFailureForRun(
  input: RefreshErrorInput,
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous) return;
    latest = {
      ...previous,
      lastErrorAt: Date.now(),
      lastErrorMessage: truncate(input.message, 200),
      lastErrorStepId: input.failedStepId,
      lastExtractorOk: input.extractorOk ?? false,
      // Circuit snapshot intentionally unchanged — bypass failures
      // don't advance the state machine.
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, input.workflowUid, postWriteRuns);
  return latest;
}

/**
 * Hard-reset the circuit for one `(workflow, env)` entry. Called
 * from the Workflow Status sidebar's "Reset circuit" action when
 * the user is confident the upstream is recovered and wants to
 * clear the backoff state without waiting for `nextAttemptAt`. Does
 * NOT touch captures / extractedAt — a manual circuit reset is
 * purely a gate clear, not an invalidation.
 */
export async function resetCircuitForRun(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous) return;
    latest = {
      ...previous,
      consecutiveFailures: 0,
      circuit: resetCircuitSnapshot(),
      // Clear error residue so the UI flips green immediately — the
      // user's "Reset" click is an explicit "I'm vouching the upstream
      // is fine now" signal.
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
      lastErrorStepId: undefined,
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, workflowUid, postWriteRuns);
  return latest;
}

export interface ClearWorkflowRunCacheOptions {
  /**
   * When set, the cache row for THIS environment is preserved and only
   * the workflow's OTHER env-keyed rows are dropped. Used by the
   * definitional-staleness path: a material request edit invalidates
   * every env's cached value, but the active env keeps serving its
   * (now stale) value until an immediate refresh lands — so it is
   * preserved here while the inactive envs re-warm on the next switch.
   *
   * `null` is a valid value — it preserves the "No environment" row.
   * Omitting the whole options object drops every row (the default).
   */
  keepEnvironmentId: string | null;
}

/**
 * Drop cached runs for one workflow. With no options, every env-keyed
 * entry is removed — called when a workflow definition is deleted, or
 * when the user hits "Clear cache" from the editor. With
 * `keepEnvironmentId`, every entry EXCEPT that env's row is removed.
 */
export async function clearWorkflowRunCache(
  workflowUid: string,
  workspaceId?: string,
  opts?: ClearWorkflowRunCacheOptions,
): Promise<number> {
  const wsId = resolveWorkspaceId(workspaceId);
  let removed = 0;
  const removedKeys: string[] = [];
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [key, entry] of Object.entries(current.runs)) {
      if (entry.workflowUid === workflowUid) {
        if (opts && entry.environmentId === opts.keepEnvironmentId) {
          nextRuns[key] = entry;
          continue;
        }
        removed++;
        removedKeys.push(key);
        continue;
      }
      nextRuns[key] = entry;
    }
    if (removed === 0) return;
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    logger.debug('LiveCacheStore', `Cleared ${removed} cache entry(ies) for workflow ${workflowUid}`);
  });
  if (removed > 0) {
    notifyChange(wsId, workflowUid, postWriteRuns);
    // Drop the synced value rows too, so a paired peer stops serving an
    // orphaned value for a workflow that no longer exists here.
    remover?.(removedKeys, wsId);
  }
  return removed;
}

/**
 * Flag every env-keyed cache row for one workflow as definitionally
 * stale — an input to the cached value's production recipe changed (a
 * material request edit, a workflow-definition change) but the value
 * has not been re-extracted. Unlike {@link clearWorkflowRunCache} the
 * rows are KEPT — the (now wrong-recipe) value keeps serving so live
 * traffic doesn't gap; the flag drives a "needs re-run" badge instead.
 *
 * Used for MANUAL-trigger workflows: a material edit must not auto-run
 * them, but must not silently keep serving a wrong-recipe token either.
 * A successful {@link putWorkflowRunCache} writes a row without the
 * flag, clearing it. No-op (returns 0) when the workflow has no cached
 * rows, or when every row is already flagged.
 */
export async function markWorkflowDefinitionallyStale(workflowUid: string, workspaceId?: string): Promise<number> {
  const wsId = resolveWorkspaceId(workspaceId);
  let flagged = 0;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [key, entry] of Object.entries(current.runs)) {
      if (entry.workflowUid === workflowUid && entry.definitionallyStale !== true) {
        nextRuns[key] = { ...entry, definitionallyStale: true };
        flagged++;
        continue;
      }
      nextRuns[key] = entry;
    }
    if (flagged === 0) return;
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    logger.debug('LiveCacheStore', `Flagged ${flagged} cache row(s) definitionally stale for workflow ${workflowUid}`);
  });
  if (flagged > 0) notifyChange(wsId, workflowUid, postWriteRuns);
  return flagged;
}

/**
 * Drop the cached run for ONE `(workflow, environment)` pair. Unlike
 * {@link clearWorkflowRunCache} (whole-workflow) this targets a single
 * env-keyed row — the LF2 path uses it when a variable edit makes one
 * NON-active environment's cached value definitionally stale: the row
 * is dropped so it re-warms on the next switch instead of serving a
 * wrong-recipe token. Returns `true` when a row was removed, `false`
 * when the workflow had no cached run for that env.
 */
export async function clearWorkflowRunCacheForEnvironment(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<boolean> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let removed = false;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    if (!(key in current.runs)) return;
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [k, entry] of Object.entries(current.runs)) {
      if (k !== key) nextRuns[k] = entry;
    }
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    removed = true;
    logger.debug('LiveCacheStore', `Cleared cache entry for ${workflowUid} (env=${envKey(environmentId)}, ws=${wsId})`);
  });
  if (removed) {
    notifyChange(wsId, workflowUid, postWriteRuns);
    remover?.([key], wsId);
  }
  return removed;
}

/**
 * Flag ONE `(workflow, environment)` cache row as definitionally stale.
 * The per-env counterpart of {@link markWorkflowDefinitionallyStale}
 * (whole-workflow): the LF2 path uses it when a variable edit makes a
 * MANUAL-trigger workflow's value in one specific environment
 * wrong-recipe — only that env's resolution carried the changed
 * variable, so only its row is flagged "needs re-run". The row is KEPT
 * (it keeps serving so live traffic doesn't gap); a successful
 * {@link putWorkflowRunCache} clears the flag. No-op (returns `false`)
 * when the workflow has no cached run for that env, or the row is
 * already flagged.
 */
export async function markRunDefinitionallyStale(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<boolean> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let flagged = false;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous || previous.definitionallyStale === true) return;
    const latest: WorkflowRunCache = { ...previous, definitionallyStale: true };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    flagged = true;
    logger.debug(
      'LiveCacheStore',
      `Flagged cache row definitionally stale for ${workflowUid} (env=${envKey(environmentId)}, ws=${wsId})`,
    );
  });
  if (flagged) notifyChange(wsId, workflowUid, postWriteRuns);
  return flagged;
}

// ── Purge (workspace delete) ────────────────────────────────────────

export async function purgeLiveCacheForWorkspace(workspaceId: string): Promise<void> {
  await withCacheLock(workspaceId, async () => {
    await hostStorage.remove(wsKeys(workspaceId).liveCache);
    logger.info('LiveCacheStore', `Purged all workflow-run caches for workspace ${workspaceId}`);
  });
  notifyChange(workspaceId, null, []);
}

// ── Scheduler snapshot ──────────────────────────────────────────────

/**
 * Flat snapshot across every workspace — Phase C scheduler uses this
 * on SW wake to reconcile overdue alarms. Mirrors the shape of
 * `listAllWorkspaceCredentials` in `oauth-token-store.ts`.
 */
export interface WorkspaceCacheEntry {
  workspaceId: string;
  run: WorkflowRunCache;
}

export async function listAllWorkspaceCaches(): Promise<WorkspaceCacheEntry[]> {
  const workspaces = (await hostStorage.get(OH.workspaces)) ?? [];
  const out: WorkspaceCacheEntry[] = [];
  for (const ws of workspaces) {
    const blob = await readBlob(ws.id);
    for (const run of Object.values(blob.runs)) {
      out.push({ workspaceId: ws.id, run });
    }
  }
  return out;
}

// ── Ref-type export ─────────────────────────────────────────────────

/** Exported for tests + callers that need to build `runKey` themselves. */
export { envKey, NO_ENV_KEY, runKey };
