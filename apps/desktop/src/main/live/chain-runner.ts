/**
 * Desktop live-workflow chain runner — the main-process counterpart to
 * the extension's `live-chain-adapter.ts`.
 *
 * Boundaries (identical split to the extension):
 *   - The scheduler (`./live-refresh-scheduler`) owns WHEN to fire.
 *   - The host-neutral engine (`@openheaders/core/live` `runChain` +
 *     `@openheaders/oracle/live/request-exec` `buildChainFetchAdapter`)
 *     owns HOW to resolve + execute each step. This is the C1 lift —
 *     the desktop reuses the exact same resolve→execute core the
 *     browser SW runs, differing only in the injected transport.
 *   - This module owns the thin desktop glue: pick the Node transport,
 *     run the chain, and commit the result to the host-neutral live
 *     cache (success → `putWorkflowRunCache`; failure →
 *     `recordRefreshError`).
 *
 * Differences from the browser adapter, all by design on a host with no
 * DNR engine and no `chrome.identity`:
 *   - `prepareRequest` is omitted — there is no `X-OH-Live-Bypass`
 *     header to stamp (no DNR rules to dodge).
 *   - `refreshOAuth` is omitted — the desktop attaches the last-synced
 *     OAuth bundle as-is; refresh-on-expired over Node is a later slice.
 *   - No manual-bypass path — the scheduler fires on cadence only; the
 *     user-triggered "Refresh now" bypass is an extension surface today.
 *   - Failure is returned, not thrown — the scheduler logs + re-arms
 *     off the return value rather than catching a control-flow error.
 *
 * Atomic refresh discipline (mirrors the extension): either every step
 * succeeds and ALL captures commit as one write, or some step fails and
 * the prior cache row is preserved with the failure context stamped.
 * `runChain` never returns a partial capture set.
 */

import { type ChainRunFailure, type ChainRunOutcome, type ChainRunSuccess, runChain } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { putWorkflowRunCache, recordRefreshError } from '@openheaders/oracle/live/live-cache-store';
import { buildChainFetchAdapter } from '@openheaders/oracle/live/request-exec/chain-adapter';
import { createNodeRequestTransport } from '@openheaders/oracle-host-node/live/node-request-transport';

/** One Node transport for the whole process — stateless, so a singleton
 *  avoids rebuilding the `fetch` wrapper on every step fetch. */
const nodeTransport = createNodeRequestTransport();

export interface DesktopRefreshArgs {
  workspaceId: string;
  workflow: LiveWorkflow;
  /** `null` = "No environment". */
  environmentId: string | null;
}

export type DesktopRefreshResult =
  | { ok: true; skippedStepIds: readonly string[] }
  | { ok: false; failedStepId: string; failedPhase: ChainRunFailure['failedPhase']; message: string };

/**
 * Run a workflow once against the Node transport and commit the outcome
 * to the live cache. Returns the outcome for the scheduler to log + use
 * when re-arming; never throws for an ordinary refresh failure (the
 * cache write already records it). A thrown error here would be an
 * unexpected store/engine fault, which the scheduler's `fire` catch
 * folds into a warn + re-arm.
 */
export async function runDesktopWorkflowRefresh(args: DesktopRefreshArgs): Promise<DesktopRefreshResult> {
  const { workspaceId, workflow, environmentId } = args;
  const adapter = buildChainFetchAdapter({ workspaceId, environmentId, transport: nodeTransport });
  const outcome: ChainRunOutcome = await runChain({
    workflow,
    adapter,
    context: { workflowUid: workflow.uid, workspaceId, environmentId },
  });

  if (outcome.ok) {
    await commitSuccess(workspaceId, workflow, environmentId, outcome);
    return { ok: true, skippedStepIds: outcome.skippedStepIds };
  }
  await commitFailure(workspaceId, workflow, environmentId, outcome);
  return {
    ok: false,
    failedStepId: outcome.failedStepId,
    failedPhase: outcome.failedPhase,
    message: outcome.failedReason,
  };
}

async function commitSuccess(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
  outcome: ChainRunSuccess,
): Promise<void> {
  // Project core Maps → the plain-object shape the cache blob stores.
  // The cache serializes JSON, not Map instances; crossing here keeps
  // the store naive. Skipped steps (gate / cascade) are intentionally
  // absent — their prior cache entries survive this atomic commit and
  // stay resolvable by `{{live.X}}`.
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
  workflow: LiveWorkflow,
  environmentId: string | null,
  outcome: ChainRunFailure,
): Promise<void> {
  // `'extract'` failures point at a user misconfiguration (json-path /
  // regex wrong against the real response) → extractor-not-ok for the
  // Status yellow path. `'fetch'` / `'graph'` are upstream / structural
  // → extractor-ok so Status uses its red path when failures compound.
  const extractorOk = outcome.failedPhase !== 'extract';
  await recordRefreshError(
    {
      workflowUid: workflow.uid,
      environmentId,
      message: outcome.failedReason,
      failedStepId: outcome.failedStepId,
      extractorOk,
    },
    workspaceId,
  );
  logger.warn(
    'DesktopLiveRunner',
    `Workflow ${workflow.uid} refresh failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${outcome.failedReason}`,
  );
}

/**
 * Wall-clock ms at which the just-written captures go stale. Pure
 * function of the refresh policy + captures; the scheduler re-reads it
 * via `CacheSummary.expiresAt` to compute the next fire. Returns `null`
 * for a manual policy or an unreadable capture (matches
 * `computeNextFireAt`'s "no schedule" semantics).
 *
 * NOTE: this mirrors the extension adapter's `deriveExpiresAt`. It is a
 * pure function of core types and a clean candidate to lift into
 * `@openheaders/core/live` in a later convergence slice; kept local here
 * to keep C3/C4 self-contained in `apps/desktop`.
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
