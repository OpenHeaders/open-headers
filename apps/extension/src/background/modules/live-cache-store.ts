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

import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, OH, wsKeys } from '@/shared/storage';
import { getActiveWorkspaceId } from './workspace-store';

// ── Cache row ──────────────────────────────────────────────────────

/**
 * One workflow's last-extraction snapshot for one environment.
 * Intentionally NOT a valibot schema — the cache is ephemeral and
 * written exclusively by the SW, so the at-rest shape is defined by
 * this interface + the `normalizeBlob` tolerant read path.
 */
export interface WorkflowRunCache {
  workflowUid: string;
  /** Active env uid at extraction time; `null` for the "No environment" state. */
  environmentId: string | null;
  /** `stepId → captureName → extractedValue` across every step. */
  stepCaptures: Record<string, Record<string, string>>;
  /** Wall-clock ms when the last successful extraction completed. */
  extractedAt: number;
  /** Derived expiry (from refresh policy / `expires-in` / `expires-at`), or null if none. */
  expiresAt: number | null;
  /** Per-step response body byte count — observability only, never value bytes. */
  stepResponseBytes: Record<string, number>;
  /** Consecutive failed refreshes since the last success. Drives backoff. */
  consecutiveFailures: number;
  /** Wall-clock ms of the last failed refresh. */
  lastErrorAt?: number;
  /** Human-readable last-failure message (truncated to 200 chars). */
  lastErrorMessage?: string;
  /** Step id where the last failure halted — lets the UI pinpoint the broken hop. */
  lastErrorStepId?: string;
  /**
   * `false` when the most recent refresh succeeded at fetching every
   * step but failed during extraction (a capture's json-path / header /
   * regex didn't match). Preserves the cache because the RESPONSE was
   * real; the extractor config is what's wrong.
   */
  lastExtractorOk: boolean;
}

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
  return {
    schemaVersion: blob.schemaVersion,
    version: blob.version,
    runs: blob.runs as Record<string, WorkflowRunCache>,
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
  return workspaceId ?? getActiveWorkspaceId();
}

function withCacheLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'live-cache', 'singleton'), fn, { op: 'live-cache-mutate' });
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

// ── Change listeners ────────────────────────────────────────────────

/**
 * Listeners receive `(workspaceId, workflowUid)` so subscribers scoped
 * to the active workspace + to specific workflows can filter without
 * re-reading the full blob on every mutation. `workflowUid === null`
 * signals a full-workspace mutation (workspace purge, bulk clear).
 */
type ChangeListener = (workspaceId: string, workflowUid: string | null) => void;
const listeners: Set<ChangeListener> = new Set();

export function onLiveCacheStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(workspaceId: string, workflowUid: string | null): void {
  for (const fn of listeners) fn(workspaceId, workflowUid);
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
 * backoff counter. Fires `onLiveCacheStoreChange`.
 */
export async function putWorkflowRunCache(input: SuccessfulRunInput, workspaceId?: string): Promise<WorkflowRunCache> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  const entry: WorkflowRunCache = {
    workflowUid: input.workflowUid,
    environmentId: input.environmentId,
    stepCaptures: input.stepCaptures,
    stepResponseBytes: input.stepResponseBytes,
    extractedAt: input.extractedAt,
    expiresAt: input.expiresAt,
    consecutiveFailures: 0,
    lastExtractorOk: true,
  };
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: entry },
    };
    await writeBlob(wsId, next);
    logger.debug(
      'LiveCacheStore',
      `Stored run for ${input.workflowUid} (env=${envKey(input.environmentId)}, ws=${wsId})`,
    );
  });
  notifyChange(wsId, input.workflowUid);
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
 * refresh discipline) and increments the consecutive-failure counter
 * so Phase C's scheduler can widen its backoff.
 */
export async function recordRefreshError(input: RefreshErrorInput, workspaceId?: string): Promise<WorkflowRunCache> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  let latest: WorkflowRunCache;
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    latest = {
      workflowUid: input.workflowUid,
      environmentId: input.environmentId,
      stepCaptures: previous?.stepCaptures ?? {},
      stepResponseBytes: previous?.stepResponseBytes ?? {},
      extractedAt: previous?.extractedAt ?? 0,
      expiresAt: previous?.expiresAt ?? null,
      consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
      lastErrorAt: Date.now(),
      lastErrorMessage: truncate(input.message, 200),
      lastErrorStepId: input.failedStepId,
      lastExtractorOk: input.extractorOk ?? false,
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
  });
  notifyChange(wsId, input.workflowUid);
  // biome-ignore lint/style/noNonNullAssertion: assigned inside withCacheLock above.
  return latest!;
}

/**
 * Drop every cached run for one workflow (all env-keyed entries).
 * Called when a workflow definition is deleted, or when the user
 * hits "Clear cache" from the editor.
 */
export async function clearWorkflowRunCache(workflowUid: string, workspaceId?: string): Promise<number> {
  const wsId = resolveWorkspaceId(workspaceId);
  let removed = 0;
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
    logger.debug('LiveCacheStore', `Cleared ${removed} cache entry(ies) for workflow ${workflowUid}`);
  });
  if (removed > 0) notifyChange(wsId, workflowUid);
  return removed;
}

// ── Purge (workspace delete) ────────────────────────────────────────

export async function purgeLiveCacheForWorkspace(workspaceId: string): Promise<void> {
  await withCacheLock(workspaceId, async () => {
    await extensionStorage.remove(wsKeys(workspaceId).liveCache);
    logger.info('LiveCacheStore', `Purged all workflow-run caches for workspace ${workspaceId}`);
  });
  notifyChange(workspaceId, null);
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
