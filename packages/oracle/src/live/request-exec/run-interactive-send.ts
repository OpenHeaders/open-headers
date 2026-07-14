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
import { type ResolvedRequest, resolveRequest, UnresolvedRequestError } from './resolve-request';
import {
  applyScriptMutation,
  resolvedToScriptSnapshot,
  type StepScriptRunner,
  toPostResponseOutcome,
  toPreRequestOutcome,
} from './script-hooks';
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

  // ── Pre-request script (lenient) ──
  // Mutations land on top of the RESOLVED request (after variable
  // substitution). A failed script applies nothing and the send still
  // reaches the wire — the outcome is on the snapshot for the surface.
  let scripts: ExecutedRequestSnapshot['scripts'] = null;
  let finalResolved: ResolvedRequest = outcome.resolved;

  if (request.preRequestScript?.trim()) {
    const result = await options.scriptRunner({
      kind: 'pre-request',
      source: request.preRequestScript,
      request: resolvedToScriptSnapshot(finalResolved),
    });
    scripts = { preRequest: toPreRequestOutcome(result) };
    if (result.succeeded && result.mutation) {
      finalResolved = applyScriptMutation(finalResolved, result.mutation);
    }
  }

  const wireResult = await executeOverTransport(finalResolved, options.transport, {});

  // ── TOTP cooldown record ── (only on a successful round-trip)
  if (wireResult.error == null) {
    for (const usage of outcome.totpUsed) {
      recordUsage(cooldownWorkspaceId, usage.name, usage.code, usage.period);
    }
  }

  // ── Post-response script (lenient) ──
  // Assertions and script errors are recorded, never mapped onto the
  // run's `error` — the Tests tab renders pass/fail counts.
  if (request.postResponseScript?.trim() && wireResult.error == null) {
    const result = await options.scriptRunner({
      kind: 'post-response',
      source: request.postResponseScript,
      request: resolvedToScriptSnapshot(finalResolved),
      response: {
        status: wireResult.status,
        statusText: wireResult.statusText,
        url: wireResult.url,
        headers: wireResult.headers,
        body: wireResult.body,
        durationMs: wireResult.durationMs,
      },
    });
    scripts = { ...(scripts ?? {}), postResponse: toPostResponseOutcome(result) };
  }

  return scripts ? { ...wireResult, scripts } : wireResult;
}
