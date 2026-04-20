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
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { putWorkflowRunCache, recordRefreshError } from './live-cache-store';
import { __setLiveRefreshAdapter, type LiveRefreshAdapter } from './live-refresh-scheduler';
import { type ExecutedRequestSnapshot, executeForLiveChain } from './request-executor';
import { getRequest } from './request-store';
import { getActiveWorkspaceId } from './workspace-store';

// ── FetchAdapter — translates runChain hops into executor calls ────

/**
 * Build the `FetchAdapter` a single `runChain` invocation consumes.
 * The adapter is closured over `(workflowUid, envId)` so each step
 * fetch carries that context without crossing the core module
 * boundary. `workspaceId` isn't threaded here because the request
 * executor reads from the ACTIVE workspace's stores — the caller
 * (`refreshWorkflow` below) guards against dispatching a refresh for
 * a non-active workspace.
 */
function buildFetchAdapter(workflowUid: string, environmentId: string | null): FetchAdapter {
  return {
    async executeStep(step, stepCaptures, _context) {
      const request = getRequest(step.requestUid);
      if (!request) {
        // Treated as a fetch-phase failure by the core runner. The
        // workflow is structurally broken (referencing a deleted
        // request); the scheduler will keep backing off until the
        // user rebinds or deletes the step.
        throw new Error(`Step request ${step.requestUid} not found`);
      }

      const snapshot = await executeForLiveChain(request, {
        environmentId,
        workflowUid,
        stepId: step.id,
        stepCaptures,
      });

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
  async refreshWorkflow({ workspaceId, workflow, environmentId }) {
    // Active-workspace guard. The request executor reads from in-memory
    // stores scoped to `getActiveWorkspaceId()`; firing a chain for an
    // inactive workspace would use the wrong env/vault/collection
    // snapshot and quietly produce garbage captures. The scheduler
    // schedules across workspaces by design (reads inactive-workspace
    // definitions directly from storage), but execution requires the
    // active slice. When the workspaces mismatch we skip + record an
    // error so the backoff widens and the scheduler reconciles when
    // the user switches workspaces.
    const active = getActiveWorkspaceId();
    if (workspaceId !== active) {
      logger.info(
        'LiveChainAdapter',
        `Skipping refresh for workflow ${workflow.uid} — workspace ${workspaceId} is not active (active=${active})`,
      );
      await recordRefreshError(
        {
          workflowUid: workflow.uid,
          environmentId,
          message: `Skipped: workspace ${workspaceId} inactive`,
          extractorOk: true,
        },
        workspaceId,
      );
      throw new ChainRefreshError(`Workspace ${workspaceId} inactive`, {
        failedStepId: workflow.steps[0]?.id ?? '',
        failedPhase: 'fetch',
      });
    }

    const outcome: ChainRunOutcome = await runChain({
      workflow,
      adapter: buildFetchAdapter(workflow.uid, environmentId),
      context: { workflowUid: workflow.uid, workspaceId, environmentId },
    });

    if (outcome.ok) {
      await commitSuccess(workspaceId, workflow, environmentId, outcome);
      return;
    }
    await commitFailure(workspaceId, workflow, environmentId, outcome);
  },
};

async function commitSuccess(
  workspaceId: string,
  workflow: V5.LiveWorkflow,
  environmentId: string | null,
  outcome: ChainRunSuccess,
): Promise<void> {
  // Project core Maps → the plain-object shape the cache blob stores.
  // Round-tripping through plain records is deliberate — the cache
  // lives in `chrome.storage.local` which serializes JSON, not Map
  // instances; crossing the boundary here keeps the store naive.
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

async function commitFailure(
  workspaceId: string,
  workflow: V5.LiveWorkflow,
  environmentId: string | null,
  outcome: ChainRunFailure,
): Promise<void> {
  const extractorOk = outcome.failedPhase !== 'extract';
  const message = outcome.failedReason;
  logger.warn(
    'LiveChainAdapter',
    `Workflow ${workflow.uid} refresh failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${message}`,
  );
  await recordRefreshError(
    {
      workflowUid: workflow.uid,
      environmentId,
      message,
      failedStepId: outcome.failedStepId,
      extractorOk,
    },
    workspaceId,
  );
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
 */
export class ChainRefreshError extends Error {
  readonly failedStepId: string;
  readonly failedPhase: 'fetch' | 'extract';
  constructor(message: string, context: { failedStepId: string; failedPhase: 'fetch' | 'extract' }) {
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
  workflow: V5.LiveWorkflow,
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
