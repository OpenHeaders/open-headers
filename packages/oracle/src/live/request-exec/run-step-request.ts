/**
 * Single request run — the host-neutral orchestration shared by Live
 * Workflow chain steps, the MCP `requests_send` tool, and the node
 * host's workbench Send: resolve the request, gate on TOTP cooldown,
 * execute over the host transport, and record TOTP usage on success.
 *
 * Scripts run ONLY when the caller injects a {@link StepScriptRunner}
 * (a workflow step with `runScripts: true` on a host with a script
 * sandbox). Without the port the run is scriptless — the MCP / daemon
 * Send paths and every step that didn't opt in are unchanged. There is
 * NO Status-pill reporting here; that stays a caller concern. Both
 * hosts — the browser SW and the desktop main process — run this exact
 * code; only the injected {@link RequestTransport} (and optional
 * OAuth-refresh / script-runner hooks) differ.
 */

import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { checkCooldown, recordUsage } from '../../entity/totp-cooldown-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { errorSnapshot, executeOverTransport } from './execute';
import { type OAuthRefreshFn, type ResolvedRequest, resolveRequest, UnresolvedRequestError } from './resolve-request';
import { collectScriptChain, runPostResponseChain, runPreRequestChain } from './script-chain';
import {
  applyScriptMutation,
  firstFailedAssertion,
  resolvedToScriptSnapshot,
  type StepScriptRunner,
} from './script-hooks';
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
  /** Env the run executes under. A string pins that environment.
   *  Explicit `null` is "No environment" on BOTH dispatch kinds — the
   *  run resolves with no env even when the unpinned Active mirrors
   *  carry an active-environment pointer. `undefined` defers to that
   *  pointer (meaningful only unpinned; a pinned scope carries no
   *  pointer, so deferring degrades to none). */
  environmentId: string | null | undefined;
  /** Captures from prior steps, installed for `{{step.<id>.<name>}}`. */
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Host network capability. */
  transport: RequestTransport;
  /** Optional host hook to refresh an expired OAuth token before send. */
  refreshOAuth?: OAuthRefreshFn;
  /** Per-attempt timeout the transport enforces on the wire round-trip. */
  timeoutMs?: number;
  /**
   * Host script capability — inject ONLY for runs that should execute
   * the request's pre/post scripts (a workflow step with
   * `runScripts: true`). Chain semantics are strict: a script error or
   * a failed assertion fails the run (see `script-hooks.ts`).
   */
  scriptRunner?: StepScriptRunner;
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
      // Verbatim — an explicit null (No environment) must survive to the
      // resolution context, where it overrides the active pointer.
      environmentId: options.environmentId,
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

  // ── Pre-request script hook (ancestor-first chain) ──
  // Collection pre → folder pre → request pre, each level its own
  // sandbox run with mutations feeding the next, on top of the
  // RESOLVED request (after variable substitution) — same layering as
  // the interactive executor. A script error fails the run before the
  // wire (strict: remaining levels don't run) — sending the unmutated
  // request and committing its captures would cache silently-wrong data.
  let scripts: ExecutedRequestSnapshot['scripts'] = null;
  let finalResolved: ResolvedRequest = outcome.resolved;
  const runner = options.scriptRunner;
  const chain = runner ? collectScriptChain(request, options.workspaceId) : { pre: [], post: [] };

  if (runner && chain.pre.length > 0) {
    const preRun = await runPreRequestChain(
      chain.pre,
      runner,
      () => resolvedToScriptSnapshot(finalResolved),
      (mutation) => {
        finalResolved = applyScriptMutation(finalResolved, mutation);
      },
      { strict: true },
    );
    scripts = { preRequest: preRun.outcome };
    if (preRun.outcome && !preRun.outcome.succeeded) {
      return {
        ...errorSnapshot(`Pre-request script failed: ${preRun.outcome.error?.message ?? 'unknown error'}`),
        scripts,
      };
    }
  }

  const wireResult = await executeOverTransport(finalResolved, options.transport, { timeoutMs: options.timeoutMs });

  // ── TOTP cooldown record ──
  // Only on a successful round-trip — a fetch that never reached the wire
  // didn't actually burn the code, and recording too eagerly would turn a
  // transient blip into an avoidable wait.
  if (wireResult.error == null) {
    for (const usage of outcome.totpUsed) {
      recordUsage(cooldownWorkspaceId, usage.name, usage.code, usage.period);
    }
  }

  // ── Post-response script hook (ancestor-first chain) ──
  // A script error or a failed `oh.test` assertion fails the run — for
  // a chain step that gates the atomic capture commit, so last-good
  // values survive a response whose shape went wrong. The wire result's
  // response fields are kept on the failure snapshot for observability.
  if (runner && chain.post.length > 0 && wireResult.error == null) {
    const postRun = await runPostResponseChain(
      chain.post,
      runner,
      resolvedToScriptSnapshot(finalResolved),
      {
        status: wireResult.status,
        statusText: wireResult.statusText,
        url: wireResult.url,
        headers: wireResult.headers,
        body: wireResult.body,
        ...(wireResult.bodyEncoding ? { bodyEncoding: wireResult.bodyEncoding } : {}),
        durationMs: wireResult.durationMs,
      },
      { strict: true },
    );
    scripts = { ...(scripts ?? {}), postResponse: postRun.outcome };
    if (postRun.outcome && !postRun.outcome.succeeded) {
      return {
        ...wireResult,
        scripts,
        error: `Post-response script failed: ${postRun.outcome.error?.message ?? 'unknown error'}`,
      };
    }
    const failed = postRun.outcome ? firstFailedAssertion(postRun.outcome.assertions) : undefined;
    if (failed) {
      return {
        ...wireResult,
        scripts,
        error: `Assertion failed: ${failed.name}${failed.message ? ` — ${failed.message}` : ''}`,
      };
    }
  }

  return scripts ? { ...wireResult, scripts } : wireResult;
}
