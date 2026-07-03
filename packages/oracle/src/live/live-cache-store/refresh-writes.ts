import { initialCircuitSnapshot, onCircuitFailure, onCircuitSuccess } from '@openheaders/core/live';
import type { RefreshHealth, WorkflowRunCache } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import {
  envKey,
  type LiveCacheBlob,
  readBlob,
  resolveWorkspaceId,
  runKey,
  truncate,
  withCacheLock,
  writeBlob,
} from './blob';
import { notifyChange } from './listeners';
import { propagator } from './propagation';

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
      // A successful run is, by definition, healthy — stamp it so the
      // synced subset (and any peer's degraded banner) reflects recovery.
      refreshHealth: 'ok',
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
        refreshHealth: 'ok',
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
  /**
   * The classified failure category (WS-C C7), from the producer's
   * `classifyRefreshHealth`. Persisted on the row and — when it is a
   * genuine category transition on a row that already holds a value —
   * propagated over §4 (preserved captures + the new health) so a peer
   * learns "the backend is present but its source/auth is failing." Omit
   * on the defensive scheduler-fallback path (no outcome to classify) —
   * the previous health is then preserved and nothing propagates.
   */
  refreshHealth?: Exclude<RefreshHealth, 'ok'>;
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
  let prior: WorkflowRunCache | undefined;
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
      // staleness flag (and its recipe-change timestamp) must survive — only
      // a successful `putWorkflowRunCache` or a provably-post-edit synced
      // value clears it.
      definitionallyStale: previous?.definitionallyStale,
      definitionallyStaleSince: previous?.definitionallyStaleSince,
      // A failed *own* refresh doesn't erase the fact that a remote value
      // recently arrived — a connected peer should keep deferring to the
      // backend rather than treat its own failure as taking over (C8).
      lastSyncedValueAt: previous?.lastSyncedValueAt,
      // Likewise a failed own refresh doesn't mean the backend is back —
      // preserve the C9 exclusive-degraded mark until a genuinely fresh
      // remote value (or an own success) clears it.
      exclusiveDegradedSince: previous?.exclusiveDegradedSince,
      // The classified failure category (WS-C C7). Absent input (the
      // defensive scheduler-fallback path) preserves the previous health
      // rather than guessing.
      refreshHealth: input.refreshHealth ?? previous?.refreshHealth,
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
    prior = previous;
  });
  notifyChange(wsId, input.workflowUid, postWriteRuns);
  // §4 health propagation (WS-C C7): a failure preserves the captures
  // (atomic refresh), so the only changed wire field is `refreshHealth`.
  // Propagate ONLY on a genuine category transition on a row that already
  // holds a value — a peer with no value has nothing to attach the health
  // to, and re-emitting an unchanged category every failed tick would
  // grow the mutation log for no new information. The peer reads presence
  // from its connection probe; this enum only specializes the banner copy.
  if (input.refreshHealth && prior && prior.extractedAt > 0 && prior.refreshHealth !== input.refreshHealth) {
    propagator?.(
      {
        runKey: key,
        value: {
          workflowUid: latest!.workflowUid,
          environmentId: latest!.environmentId,
          stepCaptures: latest!.stepCaptures,
          extractedAt: latest!.extractedAt,
          expiresAt: latest!.expiresAt,
          refreshHealth: input.refreshHealth,
        },
      },
      wsId,
    );
  }
  return latest!;
}
