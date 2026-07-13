/**
 * Live Workflow chain step executor — runs one chain step on the
 * host-neutral step runner with the SW's fetch transport, stamping the
 * `X-OH-Live-Bypass` header so DNR rules referencing the workflow's
 * LVs exclude themselves from the fetches that produce them.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import type { StepScriptRunner } from '@openheaders/oracle/live/request-exec/script-hooks';
import { logger } from '@utils/logger';
import { browserRequestTransport } from '../net/browser-request-transport';
import { OAuth2FlowError, performRefresh as performOAuthRefresh } from '../oauth-flow';
import { isOffscreenSupported, runScript } from '../offscreen-host';

/**
 * Bypass tag stamped on every Live Workflow chain fetch. Value is the
 * owning workflow uid. User rules whose value templates reference any
 * `{{live.X}}` bound to the SAME workflow exclude that exact value via
 * `excludedRequestHeaders` at DNR compile time — the rule engine's
 * `attachLiveBypassExclusions` wraps compiled rules with the filter so
 * a rule injecting `Authorization: {{live.token}}` never fires on the
 * chain fetches that PRODUCE `live.token`.
 *
 * Chrome DNR's `HeaderInfo.values` uses case-insensitive exact match,
 * which is why the value is the opaque workflow uid alone — composite
 * values like `<workflowUid>:<stepId>` couldn't be excluded without
 * enumerating every step id. The step id stays in the observability
 * log's `context.stepId`, which is where triage needs it anyway.
 */
export const LIVE_BYPASS_HEADER = 'X-OH-Live-Bypass';

/**
 * Compose the header value. Exported so the DNR compile path uses the
 * exact same string the executor stamps — any codec drift produces
 * the "rule still fires on its own source" feedback loop this whole
 * contract exists to prevent.
 */
export function liveBypassHeaderValue(workflowUid: string): string {
  return workflowUid;
}

export interface LiveChainExecuteOptions {
  /**
   * Workspace owning the workflow. Threaded through so every store read
   * (request, env, vault, vars, collection-vars, live-registry, files)
   * resolves against the per-workspace cache rather than the runtime-
   * Active mirror — required for cross-workspace chain refresh under
   * MWPT-FULL session #19.
   */
  workspaceId: string;
  /** Active env the chain was scheduled under. `null` = "No environment". */
  environmentId: string | null;
  /** Parent workflow uid — stamped into the bypass header. */
  workflowUid: string;
  /** Current step id — carried in the executor log context only. */
  stepId: string;
  /**
   * Captures extracted from prior steps of this chain run. Keys are
   * step ids; values are `captureName → extractedValue` maps. Installed
   * on the resolver so `{{step.<id>.<name>}}` templates in this step's
   * request resolve correctly.
   */
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Per-attempt timeout from the step definition, enforced by the transport. */
  timeoutMs?: number;
  /**
   * The step's `runScripts` opt-in. When true (and the runtime has an
   * offscreen sandbox), the request's pre/post scripts run under the
   * strict chain contract: read-only `oh.*` surface (`sendRequest` /
   * `variables.set` rejected), script errors and failed assertions
   * fail the step. Default / Firefox: scriptless, today's behavior.
   */
  runScripts?: boolean;
}

/**
 * Execute a persisted-request shape as one step of a Live Workflow
 * chain. Shares the resolve → fetch pipeline with `executeRequestDraft`
 * but:
 *   - threads the step-capture context into variable resolution,
 *   - runs pre/post script hooks ONLY for steps that opted in via
 *     `runScripts: true`, under a read-only host API (see
 *     `LiveChainExecuteOptions.runScripts`); all other steps stay pure
 *     data-source fetches,
 *   - stamps the `X-OH-Live-Bypass` header so DNR rules referencing
 *     the workflow's LVs exclude themselves from this request,
 *   - suppresses the `requests` Status pill (workflow refresh belongs
 *     to the `live` subsystem, not the generic request pill).
 *
 * Returned `ExecutedRequestSnapshot` is the same shape as user-facing
 * executions; the chain adapter maps it down to the core's
 * `StepResponse`.
 */
export async function executeForLiveChain(
  request: Request,
  options: LiveChainExecuteOptions,
): Promise<ExecutedRequestSnapshot> {
  const stamped: Request = {
    ...request,
    headers: [
      ...request.headers,
      {
        uid: generateUid(),
        key: LIVE_BYPASS_HEADER,
        value: liveBypassHeaderValue(options.workflowUid),
        enabled: true,
      },
    ],
  };
  // Chain steps run on the host-neutral request executor (the same code
  // the desktop runner uses), with the SW's fetch as the transport and —
  // for opted-in steps — the offscreen sandbox as the script runtime.
  // No Status-pill report is implicit in `runStepRequest` (chain
  // refreshes belong to the `live` subsystem). The OAuth-refresh hook
  // maps a recoverable `OAuth2FlowError` to `null` (attach the stale
  // bundle → the target's 401 is the signal); any other error propagates
  // as a fetch-phase failure, matching the prior executor semantics.
  return runStepRequest(stamped, {
    workspaceId: options.workspaceId,
    environmentId: options.environmentId,
    stepCaptures: options.stepCaptures,
    timeoutMs: options.timeoutMs,
    transport: browserRequestTransport,
    scriptRunner: buildChainScriptRunner(options),
    refreshOAuth: (auth) =>
      performOAuthRefresh(auth, options.workspaceId).catch((err) => {
        if (err instanceof OAuth2FlowError) {
          logger.info('RequestExecutor', `OAuth refresh failed for ${auth.credentialRef}: ${err.message}`);
          return null;
        }
        throw err;
      }),
  });
}

/**
 * Offscreen-backed script runner for an opted-in step, or `undefined`
 * to run scriptless. Firefox has no offscreen API — the opt-in is
 * honored on capable runtimes only, and the skip is logged so a
 * silent "my assertions never ran" has a trail.
 */
function buildChainScriptRunner(options: LiveChainExecuteOptions): StepScriptRunner | undefined {
  if (options.runScripts !== true) return undefined;
  if (!isOffscreenSupported()) {
    logger.info(
      'RequestExecutor',
      `Step ${options.stepId} of workflow ${options.workflowUid} requested scripts, but this runtime has no script sandbox — running scriptless`,
    );
    return undefined;
  }
  return (input) =>
    runScript({
      kind: input.kind,
      source: input.source,
      request: input.request,
      response: input.response,
      hostContext: 'chain',
    }).catch((err: unknown) => ({
      // The port contract is "never throw" — an offscreen spawn failure
      // surfaces as a failed script result, which the step runner turns
      // into a step failure with the carrier message.
      executionId: 'offscreen-unavailable',
      succeeded: false,
      error: { name: 'OffscreenSpawnError', message: err instanceof Error ? err.message : String(err) },
      assertions: [],
      consoleLog: [],
      durationMs: 0,
    }));
}
