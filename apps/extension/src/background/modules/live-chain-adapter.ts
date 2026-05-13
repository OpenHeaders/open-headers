/**
 * Live Chain Adapter — implements the scheduler's `LiveRefreshAdapter`
 * port by running a workflow's ordered steps through the request
 * executor and writing the result to the live cache.
 *
 * Boundaries:
 *   - Scheduler owns WHEN to fire (alarm + backoff + reconcile). See
 *     `live-refresh-scheduler.ts`.
 *   - Core owns HOW to orchestrate the chain (platform-agnostic
 *     `runChain` + `FetchAdapter` + extractor). See
 *     `@openheaders/core/live`.
 *   - This module owns the SW-side glue: platform fetch adapter that
 *     calls `executeForLiveChain`, mapping to and from the core's
 *     `StepResponse`, and atomic cache writes on success / failure.
 *
 * Registration happens as a module-load side effect —
 * `__setLiveRefreshAdapter(liveChainAdapter)`. `background.ts` imports
 * this module once on SW wake; the scheduler picks up the adapter
 * through the setter and every subsequent alarm dispatch routes here.
 *
 * Atomic refresh discipline: per the plan (§10, edge-case matrix),
 * either every step succeeds and ALL captures are written to cache as
 * a single transaction, or some step fails and the cache is preserved
 * unchanged with `recordRefreshError` stamping the failure context.
 * Partial writes never happen — `runChain` returns one of
 * success-with-all-captures OR failure-with-partial-trail (the partial
 * trail is observability-only; it never reaches the cache).
 *
 * What the adapter does NOT do (by design):
 *   - Refresh workflow definitions — that's the store's concern.
 *   - Decide when to fire — the scheduler drives.
 *   - Record observability log entries — `handleLiveAlarm` wraps the
 *     adapter call and does that on both sides of the await.
 *   - Install DNR bypass rules. The chain stamps `X-OH-Live-Bypass`
 *     so a future DNR compile pass (Phase E ref-counting + rule
 *     recompile on cache change) can exclude LV-referencing rules
 *     from matching the tagged request. v1 accepts that user rules
 *     DO fire on chain fetches; the consequence is well-contained
 *     (only users configuring their own auth-endpoint rewrite hit
 *     the feedback loop, and the plan explicitly calls out a toggle
 *     for that case as Phase F UI).
 */

import {
  type ChainRunFailure,
  type ChainRunOutcome,
  type ChainRunSuccess,
  type FetchAdapter,
  runChain,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { putWorkflowRunCache, recordManualBypassFailureForRun, recordRefreshError } from '@openheaders/oracle/live/live-cache-store';
import { __setLiveRefreshAdapter, type LiveRefreshAdapter } from './live-refresh-scheduler';
import { recordLog } from './observability-log';
import { withRefreshRateLimit } from './refresh-scheduler';
import { type ExecutedRequestSnapshot, executeForLiveChain } from './request-executor';
import { getRequestInWorkspace } from '@openheaders/oracle/entity/request-store';

// ── FetchAdapter — translates runChain hops into executor calls ────

/**
 * Build the `FetchAdapter` a single `runChain` invocation consumes.
 * The adapter is closured over `(workspaceId, workflowUid, envId)` so
 * each step fetch resolves its request, variables, vault, environment,
 * and collection scopes against the SAME workspace the chain dispatch
 * was scheduled under — never the runtime-Active workspace's stores.
 * Cross-workspace dispatches (a per-tab MWPT workspace's chain firing
 * while a different workspace is runtime-Active) require this so the
 * captures land against the correct workspace's variable scope.
 */
function buildFetchAdapter(workspaceId: string, workflowUid: string, environmentId: string | null): FetchAdapter {
  return {
    async executeStep(step, stepCaptures, _context) {
      const request = getRequestInWorkspace(step.requestUid, workspaceId);
      if (!request) {
        // Treated as a fetch-phase failure by the core runner. The
        // workflow is structurally broken (referencing a deleted
        // request); the scheduler will keep backing off until the
        // user rebinds or deletes the step.
        throw new Error(`Step request ${step.requestUid} not found`);
      }

      // Per-origin rate limit on the step's resolved URL. The request
      // executor resolves `{{VAR}}` inside the URL string, so for
      // rate-limiting purposes we key on the pre-resolution URL — it's
      // good enough as a bucket key (same template → same bucket) and
      // avoids paying a resolution round-trip just to pick a slot.
      // Origins that can't be parsed fall through to direct execution
      // via `withRefreshRateLimit`'s safeOrigin.
      const snapshot = await withRefreshRateLimit(request.url, () =>
        executeForLiveChain(request, {
          workspaceId,
          environmentId,
          workflowUid,
          stepId: step.id,
          stepCaptures,
        }),
      );

      if (snapshot.error != null) {
        // Network / DNS / abort — throw so `runChain` classifies this
        // as `failedPhase: 'fetch'` with the carrier message. 4xx /
        // 5xx responses DON'T throw — extractors may legitimately
        // capture error-body fields (the user configured it that
        // way), and `status-code` extractors are an explicit
        // first-class tool for retries that inspect status.
        throw new Error(snapshot.error);
      }

      return {
        status: snapshot.status,
        statusText: snapshot.statusText,
        url: snapshot.url,
        headers: snapshot.headers,
        body: snapshot.body,
      };
    },
  };
}

// ── Adapter implementation ─────────────────────────────────────────

/**
 * Core responsibilities:
 *   1. Run the workflow via `runChain`, wiring a platform fetch
 *      adapter that calls the request executor for each step.
 *   2. On success: commit ALL step captures atomically via
 *      `putWorkflowRunCache`. Derives `expiresAt` from the workflow's
 *      refresh policy so the resolver can tell stale-vs-fresh without
 *      recomputing the policy.
 *   3. On failure: preserve last-good captures and record the
 *      failure's step id + phase + message via `recordRefreshError`
 *      so Phase G's aggregation + Status pill have structured input.
 */
export const liveChainAdapter: LiveRefreshAdapter = {
  async refreshWorkflow({ workspaceId, workflow, environmentId, bypass = false }) {
    // No Active-workspace guard (MWPT-FULL session #19). The chain
    // executor now threads `workspaceId` end-to-end: every store read
    // (request, env, vault, workspace-vars, vault TOTP, collection-vars,
    // live-registry) resolves against the per-workspace cache for the
    // dispatch's workspaceId rather than the runtime-Active mirror. A
    // per-tab MWPT workspace's chain therefore fires correctly even
    // when a different workspace is runtime-Active in DNR.
    const outcome: ChainRunOutcome = await runChain({
      workflow,
      adapter: buildFetchAdapter(workspaceId, workflow.uid, environmentId),
      context: { workflowUid: workflow.uid, workspaceId, environmentId },
    });

    if (outcome.ok) {
      await commitSuccess(workspaceId, workflow, environmentId, outcome);
      return;
    }
    await commitFailure(workspaceId, workflow, environmentId, outcome, bypass);
  },
};

async function commitSuccess(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
  outcome: ChainRunSuccess,
): Promise<void> {
  // Project core Maps → the plain-object shape the cache blob stores.
  // Round-tripping through plain records is deliberate — the cache
  // lives in `chrome.storage.local` which serializes JSON, not Map
  // instances; crossing the boundary here keeps the store naive.
  //
  // Phase I: `outcome.stepCaptures` contains only COMPLETED steps.
  // Skipped steps (listed in `outcome.skippedStepIds`) are
  // intentionally absent — their prior cache entries survive the
  // atomic commit and stay resolvable by `{{live.X}}`. Per-step skip
  // entries land on the observability log below so exports carry the
  // full branch-taken picture.
  if (outcome.skippedStepIds.length > 0) {
    logger.info(
      'LiveChainAdapter',
      `Workflow ${workflow.uid} refresh skipped ${outcome.skippedStepIds.length} step(s): ${outcome.skippedStepIds.join(', ')}`,
    );
    emitSkipEntries(workspaceId, workflow, environmentId, outcome.skippedStepIds);
  }

  const stepCaptures: Record<string, Record<string, string>> = {};
  for (const [stepId, captures] of outcome.stepCaptures) {
    stepCaptures[stepId] = Object.fromEntries(captures);
  }
  const stepResponseBytes: Record<string, number> = Object.fromEntries(outcome.stepResponseBytes);

  await putWorkflowRunCache(
    {
      workflowUid: workflow.uid,
      environmentId,
      stepCaptures,
      stepResponseBytes,
      extractedAt: outcome.completedAt,
      expiresAt: deriveExpiresAt(workflow, stepCaptures, outcome.completedAt),
    },
    workspaceId,
  );
}

/**
 * Emit one `step-skipped` entry per skipped step, classifying the cause:
 *
 *   - `gate`     — the step's own `runIf` evaluated to false because a
 *                  completed ancestor's captures/status didn't match.
 *                  Expected, design-intended non-run.
 *   - `cascade`  — a clause referenced an ancestor that was itself
 *                  skipped. The skip propagates through absence.
 *
 * Classification is post-hoc but deterministic: we walk each skipped
 * step's gate clauses and check whether any reference another skipped
 * step. That's the only way a clause can evaluate false WITHOUT the
 * ancestor completing (completed ancestors produce captures/status that
 * either match or don't — both count as `gate`). The runner doesn't
 * carry a reason field on the outcome; doing the classification here
 * keeps the core return shape narrow.
 *
 * Values never appear in the emitted message — only step ids + counts +
 * the cascade upstream id (itself a step id, not a captured value).
 */
function emitSkipEntries(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
  skippedStepIds: readonly string[],
): void {
  const skippedSet = new Set(skippedStepIds);
  const stepIndex = new Map(workflow.steps.map((s) => [s.id, s]));
  for (const stepId of skippedStepIds) {
    const step = stepIndex.get(stepId);
    const gate = step?.runIf;
    let reason: 'gate' | 'cascade' = 'gate';
    let upstream: string | undefined;
    if (gate) {
      for (const clause of gate.all) {
        if (skippedSet.has(clause.stepId)) {
          reason = 'cascade';
          upstream = clause.stepId;
          break;
        }
      }
    }
    recordLog({
      subsystem: 'live',
      op: 'step-skipped',
      level: 'info',
      message:
        reason === 'cascade'
          ? `Workflow ${workflow.uid} step "${stepId}" skipped (cascade from "${upstream}")`
          : `Workflow ${workflow.uid} step "${stepId}" skipped (gate)`,
      context: {
        workspaceId,
        workflowUid: workflow.uid,
        environmentId,
      },
    });
  }
}

async function commitFailure(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
  outcome: ChainRunFailure,
  bypass: boolean,
): Promise<void> {
  // `'extract'` failures point at a user misconfiguration (JSON path /
  // regex wrong against the real response) — surface as extractor-not-ok
  // for the Status yellow path. `'fetch'` and `'graph'` are both
  // upstream / structural failures; mark extractor-ok so Status uses
  // its red path when failures compound.
  const extractorOk = outcome.failedPhase !== 'extract';
  const message = outcome.failedReason;
  logger.warn(
    'LiveChainAdapter',
    `Workflow ${workflow.uid} refresh failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${message}`,
  );
  // Manual-bypass failures MUST NOT advance the circuit state — matches
  // v4 `AdaptiveCircuitBreaker.executeWithBypass` semantics: the user's
  // clarifying click shouldn't push `nextAttemptAt` forward or bump
  // `consecutiveOpenings`. `recordManualBypassFailureForRun` writes
  // only the error-detail fields; the circuit snapshot is preserved.
  const errorInput = {
    workflowUid: workflow.uid,
    environmentId,
    message,
    failedStepId: outcome.failedStepId,
    extractorOk,
  };
  if (bypass) {
    await recordManualBypassFailureForRun(errorInput, workspaceId);
  } else {
    await recordRefreshError(errorInput, workspaceId);
  }
  // Re-throw so the scheduler's `handleLiveAlarm` records a
  // `refresh-failed` observability entry with the failure message.
  // `recordRefreshError` above is the authoritative cache write; the
  // scheduler's catch defers to the adapter's record and only reports
  // if the adapter didn't. Throwing keeps the two paths consistent.
  throw new ChainRefreshError(message, {
    failedStepId: outcome.failedStepId,
    failedPhase: outcome.failedPhase,
  });
}

/**
 * Structured refresh failure carried back to the scheduler. `name`
 * sets up a stable `errorClass` for the observability log; `cause`
 * carries the chain's phase + step metadata for Phase G aggregation.
 *
 * Phases:
 *   - `'fetch'`  — step's HTTP request errored (network / DNS / abort).
 *   - `'extract'` — extractor couldn't produce a value from a successful
 *                   response (misconfigured json-path / regex / etc.).
 *   - `'graph'`  — runtime DAG walk found an orphaned pending set
 *                   (cycle / unknown dep slipped past save-time
 *                   validation). Defensive — save-time validators
 *                   should catch this.
 */
export type ChainRefreshPhase = 'fetch' | 'extract' | 'graph';

export class ChainRefreshError extends Error {
  readonly failedStepId: string;
  readonly failedPhase: ChainRefreshPhase;
  constructor(message: string, context: { failedStepId: string; failedPhase: ChainRefreshPhase }) {
    super(message);
    this.name = 'ChainRefreshError';
    this.failedStepId = context.failedStepId;
    this.failedPhase = context.failedPhase;
  }
}

// ── Expiry derivation ─────────────────────────────────────────────

/**
 * Compute the wall-clock ms at which the just-written captures should
 * be considered stale. Pure function of the policy + captures — the
 * scheduler re-reads via `CacheSummary.expiresAt` when deciding the
 * next fire. Returns `null` when the policy is manual OR the chosen
 * capture is unreadable (matches `computeNextFireAt`'s "no schedule"
 * semantics).
 */
function deriveExpiresAt(
  workflow: LiveWorkflow,
  stepCaptures: Record<string, Record<string, string>>,
  extractedAt: number,
): number | null {
  const policy = workflow.refresh;
  switch (policy.kind) {
    case 'manual':
      return null;
    case 'interval':
      return extractedAt + policy.seconds * 1000;
    case 'expires-in': {
      const raw = stepCaptures[policy.stepId]?.[policy.captureName];
      const seconds = Number(raw);
      if (raw === undefined || !Number.isFinite(seconds)) return null;
      return extractedAt + seconds * 1000;
    }
    case 'expires-at': {
      const raw = stepCaptures[policy.stepId]?.[policy.captureName];
      const absoluteMs = Number(raw);
      if (raw === undefined || !Number.isFinite(absoluteMs)) return null;
      return absoluteMs;
    }
  }
}

// ── Register with the scheduler at module load ─────────────────────

__setLiveRefreshAdapter(liveChainAdapter);

export type { ExecutedRequestSnapshot };
// Re-export for tests — lets them flip the adapter for controlled
// injection without reaching into the scheduler's private setter.
export { __setLiveRefreshAdapter };
