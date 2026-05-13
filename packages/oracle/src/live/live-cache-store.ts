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
import type { WorkflowRunCache } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { extensionStorage, OH, wsKeys } from '@openheaders/oracle/storage';
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
  const raw = await extensionStorage.get(wsKeys(workspaceId).liveCache);
  return normalizeBlob(raw);
}

async function writeBlob(workspaceId: string, blob: LiveCacheBlob): Promise<void> {
  await extensionStorage.set(wsKeys(workspaceId).liveCache, blob);
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

/**
 * Drop every cached run for one workflow (all env-keyed entries).
 * Called when a workflow definition is deleted, or when the user
 * hits "Clear cache" from the editor.
 */
export async function clearWorkflowRunCache(workflowUid: string, workspaceId?: string): Promise<number> {
  const wsId = resolveWorkspaceId(workspaceId);
  let removed = 0;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const nextRuns: Record<string, WorkflowRunCache> = {};
    for (const [key, entry] of Object.entries(current.runs)) {
      if (entry.workflowUid === workflowUid) {
        removed++;
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
  if (removed > 0) notifyChange(wsId, workflowUid, postWriteRuns);
  return removed;
}

// ── Purge (workspace delete) ────────────────────────────────────────

export async function purgeLiveCacheForWorkspace(workspaceId: string): Promise<void> {
  await withCacheLock(workspaceId, async () => {
    await extensionStorage.remove(wsKeys(workspaceId).liveCache);
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
  const workspaces = (await extensionStorage.get(OH.workspaces)) ?? [];
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
