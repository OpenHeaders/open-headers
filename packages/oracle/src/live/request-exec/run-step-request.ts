/**
 * Single chain-step request — the host-neutral orchestration a Live
 * Workflow step runs: resolve the request, gate on TOTP cooldown,
 * execute over the host transport, and record TOTP usage on success.
 *
 * This is the chain-path counterpart to the user-facing send: it has NO
 * pre/post script hooks (chain fetches are pure data-source fetches) and
 * NO Status-pill reporting (workflow refresh belongs to the `live`
 * subsystem). Both hosts — the browser SW and the desktop main process —
 * run this exact code; only the injected {@link RequestTransport} (and
 * optional OAuth-refresh hook) differ.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { checkCooldown, recordUsage } from '../../entity/totp-cooldown-store';
import { errorSnapshot, executeOverTransport } from './execute';
import { type OAuthRefreshFn, resolveRequest, UnresolvedRequestError } from './resolve-request';
import type { RequestTransport } from './transport';

export interface RunStepRequestOptions {
  /** Workspace owning the workflow — threaded through every store read
   *  and the TOTP cooldown partition. */
  workspaceId: string;
  /** Env the chain was scheduled under. `null` = "No environment". */
  environmentId: string | null;
  /** Captures from prior steps, installed for `{{step.<id>.<name>}}`. */
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Host network capability. */
  transport: RequestTransport;
  /** Optional host hook to refresh an expired OAuth token before send. */
  refreshOAuth?: OAuthRefreshFn;
}

export async function runStepRequest(
  request: Request,
  options: RunStepRequestOptions,
): Promise<ExecutedRequestSnapshot> {
  let outcome: Awaited<ReturnType<typeof resolveRequest>>;
  try {
    outcome = await resolveRequest(request, {
      workspaceId: options.workspaceId,
      environmentId: options.environmentId ?? undefined,
      stepCaptures: options.stepCaptures,
      refreshOAuth: options.refreshOAuth,
    });
  } catch (err) {
    if (err instanceof UnresolvedRequestError) return errorSnapshot(err.message);
    throw err;
  }

  // ── TOTP cooldown gate ──
  // Refuse to send a code already used inside its window. Most providers
  // reject the reuse with a 401 anyway; surfacing it here gives an
  // actionable "wait Ns" instead of a wasted round-trip + confusing error.
  for (const usage of outcome.totpUsed) {
    const status = checkCooldown(options.workspaceId, usage.name, usage.code);
    if (status.inCooldown) {
      return errorSnapshot(
        `TOTP '${usage.name}' code can't be reused — wait ${status.remainingSeconds}s for the next window.`,
      );
    }
  }

  const wireResult = await executeOverTransport(outcome.resolved, options.transport);

  // ── TOTP cooldown record ──
  // Only on a successful round-trip — a fetch that never reached the wire
  // didn't actually burn the code, and recording too eagerly would turn a
  // transient blip into an avoidable wait.
  if (wireResult.error == null) {
    for (const usage of outcome.totpUsed) {
      recordUsage(options.workspaceId, usage.name, usage.code, usage.period);
    }
  }

  return wireResult;
}
