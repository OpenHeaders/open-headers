/**
 * Node-host live-workflow chain runner — the host-process counterpart
 * to the extension's `live-chain-adapter.ts`.
 *
 * Boundaries (identical split to the extension):
 *   - The scheduler (`./live-refresh-scheduler`) owns WHEN to fire.
 *   - The host-neutral engine (`@openheaders/core/live` `runChain` +
 *     `@openheaders/oracle/live/request-exec` `buildChainFetchAdapter`)
 *     owns HOW to resolve + execute each step. This is the C1 lift —
 *     a Node host reuses the exact same resolve→execute core the
 *     browser SW runs, differing only in the injected transport.
 *   - This module owns the thin Node-host glue: pick the Node transport,
 *     run the chain, and commit the result to the host-neutral live
 *     cache (success → `putWorkflowRunCache`; failure →
 *     `recordRefreshError`).
 *
 * Differences from the browser adapter, all by design on a host with no
 * DNR engine and no `chrome.identity`:
 *   - `prepareRequest` is omitted — there is no `X-OH-Live-Bypass`
 *     header to stamp (no DNR rules to dodge).
 *   - `refreshOAuth` is omitted — the host attaches the last-synced
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

import {
  type ChainRunFailure,
  type ChainRunOutcome,
  type ChainRunSuccess,
  classifyRefreshHealth,
  deriveExpiresAt,
  runChain,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { deriveExecutionPolicyForWorkflow } from '@openheaders/oracle/live/execution-policy-resolver';
import { putWorkflowRunCache, recordRefreshError } from '@openheaders/oracle/live/live-cache-store';
import { publishLiveVariablesProducedByRun } from '@openheaders/oracle/live/live-variable-store';
import { buildChainFetchAdapter } from '@openheaders/oracle/live/request-exec/chain-adapter';
import { createNodeRequestTransport } from '../../live/node-request-transport';
import { resolveScriptRunner } from '../script-capability';

/** One Node transport for the whole process — stateless, so a singleton
 *  avoids rebuilding the `fetch` wrapper on every step fetch. */
const nodeTransport = createNodeRequestTransport();

export interface WorkflowRefreshArgs {
  workspaceId: string;
  workflow: LiveWorkflow;
  /** `null` = "No environment". */
  environmentId: string | null;
}

export type WorkflowRefreshResult =
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
export async function runWorkflowRefresh(args: WorkflowRefreshArgs): Promise<WorkflowRefreshResult> {
  const { workspaceId, workflow, environmentId } = args;
  // Host script capability, consulted per refresh: only steps with
  // `runScripts: true` reach the runner (the adapter gates per step),
  // and it runs under the strict chain contract — read-only `oh.*`
  // tier, script errors and failed assertions fail the step. A host
  // without the capability (the headless daemon) resolves null and
  // opted-in steps run scriptless, today's behavior.
  const scripts = await resolveScriptRunner({ workspaceId, hostContext: 'chain' });
  const adapter = buildChainFetchAdapter({
    workspaceId,
    environmentId,
    transport: nodeTransport,
    scriptRunner: scripts?.runner,
  });
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
  // the store naive. Skipped steps (gate / cascade) ride
  // `skippedStepIds` into the cache write, where the skip-merge
  // preserves their prior captures (resolvable by `{{live.X}}`) and
  // stamps the per-step outcome map.
  for (const [stepId, attempts] of outcome.stepAttempts) {
    if (attempts > 1) {
      logger.info(
        'HostLiveRunner',
        `Workflow ${workflow.uid} step "${stepId}" recovered on attempt ${attempts} of its retry policy`,
      );
    }
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
      skippedStepIds: outcome.skippedStepIds,
    },
    workspaceId,
  );

  // A successful run is what brings an exposed binding live: publish any
  // draft live var bound to this workflow whose capture just produced a
  // value. Same publish-on-run contract as the browser adapter — the
  // workflow's trigger (a cadence fire or an MCP workflows_run) produces
  // the live var; Save only activates the workflow.
  await publishLiveVariablesProducedByRun(workspaceId, workflow.uid, stepCaptures);
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
  // Classify the failure (WS-C C7) so a deferring peer learns whether the
  // backend's data source or its credential is the problem. The credential
  // step set is a free byproduct of the same scan that derives the
  // execution policy.
  const { credentialStepIds } = deriveExecutionPolicyForWorkflow(workspaceId, workflow, environmentId);
  await recordRefreshError(
    {
      workflowUid: workflow.uid,
      environmentId,
      message: outcome.failedReason,
      failedStepId: outcome.failedStepId,
      extractorOk,
      refreshHealth: classifyRefreshHealth(outcome, credentialStepIds),
    },
    workspaceId,
  );
  logger.warn(
    'HostLiveRunner',
    `Workflow ${workflow.uid} refresh failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${outcome.failedReason}`,
  );
}
