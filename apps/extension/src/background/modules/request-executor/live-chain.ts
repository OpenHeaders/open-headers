/**
 * Live Workflow chain step executor — runs one chain step on the
 * host-neutral step runner with the SW's fetch transport, stamping the
 * `X-OH-Live-Bypass` header so DNR rules referencing the workflow's
 * LVs exclude themselves from the fetches that produce them.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import { logger } from '@utils/logger';
import { browserRequestTransport } from '../browser-request-transport';
import { OAuth2FlowError, performRefresh as performOAuthRefresh } from '../oauth-flow';

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
}

/**
 * Execute a persisted-request shape as one step of a Live Workflow
 * chain. Shares the resolve → fetch pipeline with `executeRequestDraft`
 * but:
 *   - threads the step-capture context into variable resolution,
 *   - skips pre/post script hooks (chain fetches are pure data-source
 *     fetches; running user scripts here would blur "my request" vs
 *     "workflow refresh" and trivially recurse via `oh.sendRequest`),
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
  // the desktop runner uses), with the SW's fetch as the transport. No
  // scripts + no Status-pill report are implicit in `runStepRequest`
  // (chain refreshes belong to the `live` subsystem). The OAuth-refresh
  // hook maps a recoverable `OAuth2FlowError` to `null` (attach the stale
  // bundle → the target's 401 is the signal); any other error propagates
  // as a fetch-phase failure, matching the prior executor semantics.
  return runStepRequest(stamped, {
    workspaceId: options.workspaceId,
    environmentId: options.environmentId,
    stepCaptures: options.stepCaptures,
    transport: browserRequestTransport,
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
