/**
 * Interactive Send with scripts — the node hosts' twin of the browser
 * SW's `executeRequestDraft` pipeline (its `api.ts`): resolve → TOTP
 * cooldown gate → pre-request script → wire → cooldown record →
 * post-response script, under INTERACTIVE (lenient) script semantics:
 *
 *   - a pre-request script failure is recorded on `snapshot.scripts`
 *     and the send still proceeds to the wire, unmutated — the user is
 *     watching and the response surface shows the script error inline;
 *   - a post-response script failure or a failed `oh.test` assertion
 *     never fails the run — assertions render in the response panel's
 *     Tests tab with their pass/fail counts.
 *
 * This is deliberately a SEPARATE orchestration from `runStepRequest`,
 * exactly as it is in the extension: chain runs are strict (a script
 * error or failed assertion fails the step, gating the atomic capture
 * commit), an interactive Send is not. The shared pieces — resolver,
 * TOTP gates, wire execution, script snapshot/mutation helpers — are
 * the same modules; only the failure mapping differs. Callers without
 * a script runner should keep using `runStepRequest`; the two are
 * behavior-identical when no script runs.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { checkCooldown, recordUsage } from '../../entity/totp-cooldown-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { errorSnapshot, executeOverTransport } from './execute';
import { type OAuthRefreshFn, type ResolvedRequest, resolveRequest, UnresolvedRequestError } from './resolve-request';
import { collectScriptChain, runPostResponseChain, runPreRequestChain } from './script-chain';
import { applyScriptMutation, resolvedToScriptSnapshot, type StepScriptRunner } from './script-hooks';
import type { RequestTransport } from './transport';

export interface RunInteractiveSendOptions {
  /** See `RunStepRequestOptions.workspaceId` — `null` = the
   *  runtime-Active workspace via the Active-bound module mirrors. */
  workspaceId: string | null;
  /** See `RunStepRequestOptions.environmentId` — verbatim tri-state. */
  environmentId: string | null | undefined;
  /** Host network capability. */
  transport: RequestTransport;
  /** Host script capability — the sandbox-backed runner. */
  scriptRunner: StepScriptRunner;
  /** Optional host hook to refresh an expired OAuth token before send. */
  refreshOAuth?: OAuthRefreshFn;
}

export async function runInteractiveSend(
  request: Request,
  options: RunInteractiveSendOptions,
): Promise<ExecutedRequestSnapshot> {
  const cooldownWorkspaceId = options.workspaceId ?? getActiveWorkspaceId();
  let outcome: Awaited<ReturnType<typeof resolveRequest>>;
  try {
    outcome = await resolveRequest(request, {
      workspaceId: options.workspaceId ?? undefined,
      environmentId: options.environmentId,
      refreshOAuth: options.refreshOAuth,
    });
  } catch (err) {
    if (err instanceof UnresolvedRequestError) return errorSnapshot(err.message);
    throw err;
  }

  // ── TOTP cooldown gate ── (same contract as `runStepRequest`)
  for (const usage of outcome.totpUsed) {
    const status = checkCooldown(cooldownWorkspaceId, usage.name, usage.code);
    if (status.inCooldown) {
      return errorSnapshot(
        `TOTP '${usage.name}' code can't be reused — wait ${status.remainingSeconds}s for the next window.`,
      );
    }
  }

  // ── Pre-request scripts (lenient, ancestor-first) ──
  // Collection pre → folder pre → request pre, each level its own
  // sandbox run with mutations feeding the next. Mutations land on top
  // of the RESOLVED request (after variable substitution). A failed
  // level applies nothing, the remaining levels still run, and the
  // send still reaches the wire — the folded outcome is on the
  // snapshot for the surface.
  const chain = collectScriptChain(request, options.workspaceId);
  let scripts: ExecutedRequestSnapshot['scripts'] = null;
  let finalResolved: ResolvedRequest = outcome.resolved;

  const preRun = await runPreRequestChain(
    chain.pre,
    options.scriptRunner,
    () => resolvedToScriptSnapshot(finalResolved),
    (mutation) => {
      finalResolved = applyScriptMutation(finalResolved, mutation);
    },
    { strict: false },
  );
  if (preRun.outcome) scripts = { preRequest: preRun.outcome };

  const wireResult = await executeOverTransport(finalResolved, options.transport, {});

  // ── TOTP cooldown record ── (only on a successful round-trip)
  if (wireResult.error == null) {
    for (const usage of outcome.totpUsed) {
      recordUsage(cooldownWorkspaceId, usage.name, usage.code, usage.period);
    }
  }

  // ── Post-response scripts (lenient, ancestor-first) ──
  // Assertions and script errors are recorded, never mapped onto the
  // run's `error` — the Tests tab renders pass/fail counts.
  if (chain.post.length > 0 && wireResult.error == null) {
    const postRun = await runPostResponseChain(
      chain.post,
      options.scriptRunner,
      resolvedToScriptSnapshot(finalResolved),
      {
        status: wireResult.status,
        statusText: wireResult.statusText,
        url: wireResult.url,
        headers: wireResult.headers,
        body: wireResult.body,
        durationMs: wireResult.durationMs,
      },
      { strict: false },
    );
    if (postRun.outcome) scripts = { ...(scripts ?? {}), postResponse: postRun.outcome };
  }

  return scripts ? { ...wireResult, scripts } : wireResult;
}
