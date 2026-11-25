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
 *   - Failure is returned, not thrown — the scheduler logs + re-arms
 *     off the return value rather than catching a control-flow error.
 *
 * Every run feeds its step events to the host's surfaces — a cadence
 * fire, an agent's call, a person's press alike (the workflow runs plan,
 * The Run view). A press that overrides an open circuit arrives with
 * `bypass` set: its failure records the error and leaves the circuit
 * where it was.
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
  isRunnableWorkflow,
  refusedRunEvents,
  runChain,
  UNKNOWN_STEP_PHASE,
  unknownStepMessage,
  unknownStepsOf,
} from '@openheaders/core/live';
import type { LiveWorkflow, RunnableWorkflow } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { deriveExecutionPolicyForWorkflow } from '@openheaders/oracle/live/execution-policy-resolver';
import {
  putWorkflowRunCache,
  type RefreshErrorInput,
  recordManualBypassFailureForRun,
  recordRefreshError,
} from '@openheaders/oracle/live/live-cache-store';
import { publishLiveVariablesProducedByRun } from '@openheaders/oracle/live/live-variable-store';
import { buildChainFetchAdapter } from '@openheaders/oracle/live/request-exec/chain-adapter';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { openWorkflowRunFeed } from '@openheaders/oracle/live/workflow-run-feed';
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
  /** A manual press against an open circuit — a failure leaves the circuit as it was. */
  bypass?: boolean;
  /** The caller's id for a run it started — the run's step events carry it. */
  runId?: string;
}

export type WorkflowRefreshResult =
  | { ok: true; skippedStepIds: readonly string[] }
  | {
      ok: false;
      failedStepId: string;
      failedPhase: ChainRunFailure['failedPhase'] | typeof UNKNOWN_STEP_PHASE;
      message: string;
    };

/**
 * Run a workflow once against the Node transport and commit the outcome
 * to the live cache. Returns the outcome for the scheduler to log + use
 * when re-arming; never throws for an ordinary refresh failure (the
 * cache write already records it). A thrown error here would be an
 * unexpected store/engine fault, which the scheduler's `fire` catch
 * folds into a warn + re-arm.
 */
export async function runWorkflowRefresh(args: WorkflowRefreshArgs): Promise<WorkflowRefreshResult> {
  const { workspaceId, workflow, environmentId, bypass = false, runId } = args;
  const onEvent = openWorkflowRunFeed({ workspaceId, workflowUid: workflow.uid, environmentId, runId });
  if (!isRunnableWorkflow(workflow)) {
    for (const event of refusedRunEvents(workflow, Date.now())) onEvent(event);
    return refuseUnknownSteps(workspaceId, workflow, environmentId, bypass);
  }
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
    // Refresh-on-expired for oauth2-authed steps — the host-neutral
    // runner with the extension's exact semantics (recoverable failure
    // → stale bundle attaches, the target's 401 speaks).
    refreshOAuth: buildRefreshOAuthHook(workspaceId, nodeTransport),
  });
  const outcome: ChainRunOutcome = await runChain({
    workflow,
    adapter,
    context: { workflowUid: workflow.uid, workspaceId, environmentId },
    onEvent,
  });

  if (outcome.ok) {
    await commitSuccess(workspaceId, workflow, environmentId, outcome);
    return { ok: true, skippedStepIds: outcome.skippedStepIds };
  }
  await commitFailure(workspaceId, workflow, environmentId, outcome, bypass);
  return {
    ok: false,
    failedStepId: outcome.failedStepId,
    failedPhase: outcome.failedPhase,
    message: outcome.failedReason,
  };
}

/**
 * A run that cannot run every step runs none (the workflow runs plan,
 * Laws). The workflow holds a step this build does not know: nothing is
 * sent, nothing is published, and the cache row records the first such
 * step and the sentence. No health is passed — a refusal is neither the
 * source nor the credential failing, and nothing rides to a peer.
 */
async function refuseUnknownSteps(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
  bypass: boolean,
): Promise<WorkflowRefreshResult> {
  const [step] = unknownStepsOf(workflow);
  const message = unknownStepMessage(step);
  const errorInput = { workflowUid: workflow.uid, environmentId, message, failedStepId: step.id, extractorOk: true };
  if (bypass) await recordManualBypassFailureForRun(errorInput, workspaceId);
  else await recordRefreshError(errorInput, workspaceId);
  logger.warn('HostLiveRunner', `Workflow ${workflow.uid} was not run: ${message}`);
  return { ok: false, failedStepId: step.id, failedPhase: UNKNOWN_STEP_PHASE, message };
}

async function commitSuccess(
  workspaceId: string,
  workflow: RunnableWorkflow,
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
  workflow: RunnableWorkflow,
  environmentId: string | null,
  outcome: ChainRunFailure,
  bypass: boolean,
): Promise<void> {
  // `'extract'` failures point at a user misconfiguration (json-path /
  // regex wrong against the real response) → extractor-not-ok for the
  // Status yellow path. `'fetch'` / `'graph'` are upstream / structural
  // → extractor-ok so Status uses its red path when failures compound.
  const errorInput: RefreshErrorInput = {
    workflowUid: workflow.uid,
    environmentId,
    message: outcome.failedReason,
    failedStepId: outcome.failedStepId,
    extractorOk: outcome.failedPhase !== 'extract',
  };
  if (bypass) {
    // Not a natural producer tick — the circuit and the synced health
    // both stay as they were.
    await recordManualBypassFailureForRun(errorInput, workspaceId);
  } else {
    // Classify the failure (WS-C C7) so a deferring peer learns whether the
    // backend's data source or its credential is the problem. The credential
    // step set is a free byproduct of the same scan that derives the
    // execution policy.
    const { credentialStepIds } = deriveExecutionPolicyForWorkflow(workspaceId, workflow, environmentId);
    await recordRefreshError(
      { ...errorInput, refreshHealth: classifyRefreshHealth(outcome, credentialStepIds) },
      workspaceId,
    );
  }
  logger.warn(
    'HostLiveRunner',
    `Workflow ${workflow.uid} refresh failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${outcome.failedReason}`,
  );
}
