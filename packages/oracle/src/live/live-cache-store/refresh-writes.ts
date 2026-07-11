import { initialCircuitSnapshot, onCircuitFailure, onCircuitSuccess } from '@openheaders/core/live';
import type { RefreshHealth, WorkflowRunCache, WorkflowStepOutcome } from '@openheaders/core/types';
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
  /** Captures for the steps that COMPLETED this run — skipped steps absent. */
  stepCaptures: Record<string, Record<string, string>>;
  stepResponseBytes: Record<string, number>;
  extractedAt: number;
  expiresAt: number | null;
  /**
   * Steps the runner gate-skipped this run (directly or by cascade).
   * The write merges each skipped step's PRIOR captures onto the new
   * row so its exposed `{{live.X}}` values stay resolvable — the
   * atomic-refresh contract both chain adapters document. Steps in
   * neither `stepCaptures` nor this list (deleted / renamed) drop off.
   */
  skippedStepIds?: readonly string[];
}

/**
 * Atomically write a successful workflow-run extraction. Clears any
 * accumulated failure state — a successful refresh resets the
 * backoff counter AND applies `onCircuitSuccess` to the persisted
 * circuit snapshot so the state machine closes the breaker (with
 * decay of `consecutiveOpenings` where appropriate). Stamps
 * `stepOutcomes` from the runner's attestation (completed = has a
 * captures entry this run; skipped = listed in `skippedStepIds`).
 * Fires `onLiveCacheStoreChange` with the post-write snapshot.
 */
export async function putWorkflowRunCache(input: SuccessfulRunInput, workspaceId?: string): Promise<WorkflowRunCache> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  const skippedStepIds = input.skippedStepIds ?? [];
  let entry!: WorkflowRunCache;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    const priorCircuit = previous?.circuit ?? initialCircuitSnapshot();
    const nextCircuit = onCircuitSuccess(priorCircuit, input.extractedAt);
    // Skip-merge: a gate-skipped step keeps its prior captures (and
    // byte count) so `{{live.X}}` bound to it stays resolvable across
    // a run that legitimately didn't execute it. Merging ONLY steps
    // the runner attests as skipped lets deleted steps drop off.
    const stepCaptures = { ...input.stepCaptures };
    const stepResponseBytes = { ...input.stepResponseBytes };
    const stepOutcomes: Record<string, WorkflowStepOutcome> = {};
    for (const stepId of Object.keys(input.stepCaptures)) {
      stepOutcomes[stepId] = 'completed';
    }
    for (const stepId of skippedStepIds) {
      stepOutcomes[stepId] = 'skipped';
      const prior = previous?.stepCaptures[stepId];
      if (prior !== undefined) stepCaptures[stepId] = prior;
      const priorBytes = previous?.stepResponseBytes[stepId];
      if (priorBytes !== undefined) stepResponseBytes[stepId] = priorBytes;
    }
    entry = {
      workflowUid: input.workflowUid,
      environmentId: input.environmentId,
      stepCaptures,
      stepResponseBytes,
      stepOutcomes,
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
        // The merged set (skip-preserved captures included) — a peer
        // resolving `{{live.X}}` needs the full resolvable value set,
        // not only the steps that happened to execute this run.
        stepCaptures: entry.stepCaptures,
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
      // The outcome map describes the preserved last-success captures,
      // so it survives a failed refresh exactly as they do.
      stepOutcomes: previous?.stepOutcomes,
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
