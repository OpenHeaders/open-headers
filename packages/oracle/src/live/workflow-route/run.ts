/**
 * One workflow run on a host that runs in the realm of its stores — the
 * node hosts and the served web tab; the extension's worker and page have
 * their own starters of the same pure runner.
 *
 * Boundaries:
 *   - Whoever calls owns WHEN: a scheduler's fire, an agent's call, a
 *     person's press through the manual-refresh rule.
 *   - The host-neutral engine (`@openheaders/core/live` `runChain` +
 *     `buildChainFetchAdapter`) owns HOW each step resolves and executes.
 *   - This module owns the glue between them: the check before the run,
 *     the adapter and the session host over the host's two transports
 *     (`./host`), and the commit of the outcome to the live cache
 *     (success → `putWorkflowRunCache`; failure → `recordRefreshError`).
 *
 * There is no `prepareRequest`: no host that runs here has a rule engine
 * whose rules the fetch must dodge. Failure is returned, not thrown — a
 * scheduler logs and re-arms off the return value.
 *
 * Every run feeds its step events to the host's surfaces — a cadence
 * fire, an agent's call, a person's press alike (the workflow runs plan,
 * The Run view). A press that overrides an open circuit arrives with
 * `bypass` set: its failure records the error and leaves the circuit
 * where it was.
 *
 * A session step runs on an MQTT request, over the host's byte
 * transport (the workflow runs plan, The model); what the host cannot
 * run is refused before the first step (`../run-check`).
 *
 * Atomic refresh discipline: either every step succeeds and ALL captures
 * commit as one write, or some step fails and the prior cache row is
 * preserved with the failure context stamped. `runChain` never returns a
 * partial capture set.
 */

import {
  type ChainRunFailure,
  type ChainRunOutcome,
  type ChainRunSuccess,
  classifyRefreshHealth,
  deriveExpiresAt,
  type RunRefusal,
  runChain,
  runRefusalEvents,
  UNKNOWN_STEP_PHASE,
} from '@openheaders/core/live';
import type { LiveWorkflow, MqttRequest } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { snapshotMqttRequestPostStates } from '../../sync/service';
import { deriveExecutionPolicyForWorkflow } from '../execution-policy-resolver';
import {
  putWorkflowRunCache,
  type RefreshErrorInput,
  recordManualBypassFailureForRun,
  recordRefreshError,
} from '../live-cache-store';
import { publishLiveVariablesProducedByRun } from '../live-variable-store';
import { createMqttRunSessionHost } from '../mqtt-exec/run-session';
import { buildChainFetchAdapter } from '../request-exec/chain-adapter';
import { createChainTemplateResolver } from '../request-exec/chain-template-resolver';
import { buildRefreshOAuthHook } from '../request-exec/oauth-refresh';
import { checkWorkflowRun } from '../run-check';
import { getHostScriptCapability, resolveScriptRunner, resolveSessionScriptHost } from '../script-host/capability';
import { openWorkflowRunFeed } from '../workflow-run-feed';
import type { WorkflowRouteHost } from './host';

const SCOPE = 'HostLiveRunner';

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
 * Run a workflow once over the host's transports and commit the outcome
 * to the live cache. Returns the outcome for the caller to log and re-arm
 * on; never throws for an ordinary refresh failure (the cache write
 * already records it). A thrown error here is an unexpected store or
 * engine fault.
 */
export async function runWorkflowRefresh(
  args: WorkflowRefreshArgs,
  host: WorkflowRouteHost,
): Promise<WorkflowRefreshResult> {
  const { workspaceId, workflow, environmentId, bypass = false, runId } = args;
  const onEvent = openWorkflowRunFeed({ workspaceId, workflowUid: workflow.uid, environmentId, runId });
  const findMqttRequest = (uid: string): MqttRequest | null =>
    snapshotMqttRequestPostStates(workspaceId).find((state) => state.mqttRequest.uid === uid)?.mqttRequest ?? null;
  const checked = checkWorkflowRun(workflow, { findMqttRequest, runsScripts: getHostScriptCapability() !== null });
  if (!checked.ok) {
    for (const event of runRefusalEvents(workflow, Date.now(), checked.refusals)) onEvent(event);
    return refuseRun(workspaceId, workflow, environmentId, bypass, checked.refusals[0]);
  }
  // Host script capability, consulted per refresh: only steps with
  // `runScripts: true` reach the runner (the adapter gates per step),
  // and it runs under the strict chain contract — read-only `oh.*`
  // tier, script errors and failed assertions fail the step. A host
  // without the capability (the headless daemon) resolves null and
  // opted-in steps run scriptless.
  const scripts = await resolveScriptRunner({ workspaceId, hostContext: 'chain' });
  const transport = host.requestTransportFor(workspaceId);
  const adapter = buildChainFetchAdapter({
    workspaceId,
    environmentId,
    transport,
    scriptRunner: scripts?.runner,
    // Refresh-on-expired for oauth2-authed steps — the host-neutral
    // runner (recoverable failure → stale bundle attaches, the target's
    // 401 speaks).
    refreshOAuth: buildRefreshOAuthHook(workspaceId, transport),
  });
  const outcome: ChainRunOutcome = await runChain({
    workflow: checked.workflow,
    adapter,
    context: { workflowUid: workflow.uid, workspaceId, environmentId },
    onEvent,
    resolveTemplate: createChainTemplateResolver(),
    sessions: createMqttRunSessionHost({
      workspaceId,
      environmentId,
      transport: host.mqttTransportFor(workspaceId),
      findRequest: findMqttRequest,
      // A run's session rides the run's tier, never the editor's.
      resolveScriptHost: () => resolveSessionScriptHost({ workspaceId, hostContext: 'chain' }),
    }),
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
 * Laws). The workflow holds a step this host refuses: nothing is sent,
 * nothing is published, and the cache row records the first such step
 * and its sentence. No health is passed — a refusal is neither the
 * source nor the credential failing, and nothing rides to a peer.
 */
async function refuseRun(
  workspaceId: string,
  workflow: LiveWorkflow,
  environmentId: string | null,
  bypass: boolean,
  refusal: RunRefusal,
): Promise<WorkflowRefreshResult> {
  const { stepId, reason } = refusal;
  const errorInput = {
    workflowUid: workflow.uid,
    environmentId,
    message: reason,
    failedStepId: stepId,
    extractorOk: true,
  };
  if (bypass) await recordManualBypassFailureForRun(errorInput, workspaceId);
  else await recordRefreshError(errorInput, workspaceId);
  logger.warn(SCOPE, `Workflow ${workflow.uid} was not run: ${reason}`);
  return { ok: false, failedStepId: stepId, failedPhase: UNKNOWN_STEP_PHASE, message: reason };
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
        SCOPE,
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
  // workflow's trigger produces the live var; Save only activates the
  // workflow.
  await publishLiveVariablesProducedByRun(workspaceId, workflow.uid, stepCaptures);
}

async function commitFailure(
  workspaceId: string,
  workflow: LiveWorkflow,
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
    SCOPE,
    `Workflow ${workflow.uid} refresh failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${outcome.failedReason}`,
  );
}
