/**
 * Single scriptless request run — the host-neutral orchestration shared
 * by Live Workflow chain steps, the MCP `requests_send` tool, and the
 * node host's workbench Send: resolve the request, gate on TOTP
 * cooldown, execute over the host transport, and record TOTP usage on
 * success.
 *
 * It has NO pre/post script hooks and NO Status-pill reporting — those
 * are caller concerns layered above (the extension's user-facing
 * executor runs its own script pipeline; chain fetches are pure
 * data-source fetches). Both hosts — the browser SW and the desktop
 * main process — run this exact code; only the injected
 * {@link RequestTransport} (and optional OAuth-refresh hook) differ.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { checkCooldown, recordUsage } from '../../entity/totp-cooldown-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { errorSnapshot, executeOverTransport } from './execute';
import { type OAuthRefreshFn, resolveRequest, UnresolvedRequestError } from './resolve-request';
import type { RequestTransport } from './transport';

export interface RunStepRequestOptions {
  /**
   * Workspace the run resolves against — threaded through every store
   * read and the TOTP cooldown partition. `null` = the runtime-Active
   * workspace via the Active-bound module mirrors (the workbench Send
   * path: active environment pointer + Active live registry). Chain and
   * MCP dispatches always pin an explicit id so a non-Active
   * workspace's run never reads another workspace's scopes.
   */
  workspaceId: string | null;
  /** Env the run executes under. `null` = "No environment" on a pinned
   *  dispatch; on an unpinned (Active-bound) run it defers to the
   *  workspace's active-environment pointer. */
  environmentId: string | null;
  /** Captures from prior steps, installed for `{{step.<id>.<name>}}`. */
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Host network capability. */
  transport: RequestTransport;
  /** Optional host hook to refresh an expired OAuth token before send. */
  refreshOAuth?: OAuthRefreshFn;
  /** Per-attempt timeout the transport enforces on the wire round-trip. */
  timeoutMs?: number;
}

export async function runStepRequest(
  request: Request,
  options: RunStepRequestOptions,
): Promise<ExecutedRequestSnapshot> {
  // The cooldown partition needs a concrete key even for an unpinned
  // run — the runtime-Active workspace is what that run resolved against.
  const cooldownWorkspaceId = options.workspaceId ?? getActiveWorkspaceId();
  let outcome: Awaited<ReturnType<typeof resolveRequest>>;
  try {
    outcome = await resolveRequest(request, {
      workspaceId: options.workspaceId ?? undefined,
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
    const status = checkCooldown(cooldownWorkspaceId, usage.name, usage.code);
    if (status.inCooldown) {
      return errorSnapshot(
        `TOTP '${usage.name}' code can't be reused — wait ${status.remainingSeconds}s for the next window.`,
      );
    }
  }

  const wireResult = await executeOverTransport(outcome.resolved, options.transport, { timeoutMs: options.timeoutMs });

  // ── TOTP cooldown record ──
  // Only on a successful round-trip — a fetch that never reached the wire
  // didn't actually burn the code, and recording too eagerly would turn a
  // transient blip into an avoidable wait.
  if (wireResult.error == null) {
    for (const usage of outcome.totpUsed) {
      recordUsage(cooldownWorkspaceId, usage.name, usage.code, usage.period);
    }
  }

  return wireResult;
}
