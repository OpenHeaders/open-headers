/**
 * Executor API — the public `executeRequest` / `executeRequestDraft`
 * entry points: resolve → TOTP cooldown gate → pre-request script →
 * wire fetch → cooldown record → post-response script. Registers
 * itself with the offscreen host at module load so `oh.sendRequest`
 * routes through the same pipeline.
 */

import type { RequestMutation, RequestSnapshot, ResponseSnapshot } from '@openheaders/core/scripts';
import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { getRequest, getRequestInWorkspace } from '@openheaders/oracle/entity/request-store';
import {
  checkCooldown as checkTotpCooldown,
  recordUsage as recordTotpUsage,
} from '@openheaders/oracle/entity/totp-cooldown-store';
import { __setExecuteRequestDraft, isOffscreenSupported, runScript } from '../offscreen-host';
import { getActiveWorkspaceId } from '../workspace/workspace-store';
import { defaultContentType } from './body';
import { errorSnapshot, executeResolved } from './execute';
import { type ResolvedRequest, type ResolvedRequestOutcome, resolveRequest, UnresolvedRequestError } from './resolve';

export interface ExecuteRequestOptions {
  /**
   * Pin the workspace this execution resolves against. When omitted,
   * every store read defaults to the runtime-Active workspace's mirror
   * (the user-initiated `Send` path inside the workbench). When set,
   * the resolver pulls vault / environments / vars / collections / live-
   * registry / files via per-workspace caches keyed on this id —
   * required for live-refresh chain dispatches against a non-Active
   * workspace (MWPT-FULL session #19). Resolving against the wrong
   * workspace would silently substitute a different workspace's
   * variable values and capture garbage.
   */
  workspaceId?: string;
  /** Pin a specific environment for this execution — leave undefined
   *  to use the workspace's active environment. */
  environmentId?: string;
  /**
   * Install a step-capture context on the resolver for the duration of
   * this execution so `{{step.<stepId>.<captureName>}}` references in
   * the request's templates resolve. Only used by Live Workflow chain
   * runs — regular user fetches leave this unset (any `{{step.X.Y}}`
   * in their templates surfaces as `step-out-of-context`).
   */
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /**
   * Skip the `requests` Status-pill report. Workflow refreshes aren't
   * user-initiated requests; their success/failure belongs to the
   * `live` subsystem (Phase G wires that) rather than flipping the
   * generic request-executor pill on every chain step.
   */
  silentStatus?: boolean;
  /**
   * Skip pre-request + post-response script hooks. Chain step fetches
   * are pure data-source fetches — running user scripts on them would
   * blur the boundary between "my request" and "workflow refresh" and
   * open a trivial infinite-recursion path (script calls sendRequest
   * which triggers the same workflow).
   */
  skipScripts?: boolean;
}

/** Resolve + execute a persisted request by uid. */
export async function executeRequest(
  requestUid: string,
  options: ExecuteRequestOptions = {},
): Promise<ExecutedRequestSnapshot> {
  const request = options.workspaceId ? getRequestInWorkspace(requestUid, options.workspaceId) : getRequest(requestUid);
  if (!request) {
    return errorSnapshot(`Request ${requestUid} not found`);
  }
  return executeRequestDraft(request, options);
}

/** Execute an in-memory request shape (for unsaved drafts + tests). */
export async function executeRequestDraft(
  request: Request,
  options: ExecuteRequestOptions = {},
): Promise<ExecutedRequestSnapshot> {
  let outcome: ResolvedRequestOutcome;
  try {
    outcome = await resolveRequest(request, options);
  } catch (err) {
    // The resolvability gate is the only throwing path we surface as a
    // structured snapshot today. Other exceptions (file-registry load
    // failure, unexpected resolver throw) bubble up to the caller's
    // try/catch, which is where they belong.
    if (err instanceof UnresolvedRequestError) return errorSnapshot(err.message);
    throw err;
  }

  // ── TOTP cooldown gate ─────────────────────────────────────────
  // If the resolved request reuses a TOTP code that was already used
  // inside the same window, refuse to send. Most providers reject the
  // reuse with a 401 anyway; surfacing this here gives the user an
  // actionable message ("wait Ns") instead of a confusing provider
  // error after a wasted round-trip.
  if (outcome.totpUsed.length > 0) {
    const workspaceId = options.workspaceId ?? getActiveWorkspaceId();
    for (const usage of outcome.totpUsed) {
      const status = checkTotpCooldown(workspaceId, usage.name, usage.code);
      if (status.inCooldown) {
        return errorSnapshot(
          `TOTP '${usage.name}' code can't be reused — wait ${status.remainingSeconds}s for the next window.`,
        );
      }
    }
  }

  // ── Pre-request script hook ────────────────────────────────────
  // Run BEFORE the wire fetch. Script mutations land on top of the
  // resolved request (after variable substitution). Missing scripts
  // / Firefox fallback / empty source are all no-ops.
  let scriptOutcome: ExecutedRequestSnapshot['scripts'] = null;
  const finalResolved: ResolvedRequest = { ...outcome.resolved };

  if (!options.skipScripts && request.preRequestScript?.trim() && isOffscreenSupported()) {
    const snapshot = resolvedToSnapshot(finalResolved);
    const result = await runScript({
      kind: 'pre-request',
      source: request.preRequestScript,
      request: snapshot,
    });
    scriptOutcome = {
      preRequest: {
        succeeded: result.succeeded,
        error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
        consoleLog: result.consoleLog,
        durationMs: result.durationMs,
        mutation: result.mutation,
      },
    };
    if (result.succeeded && result.mutation) {
      applyMutation(finalResolved, result.mutation);
    }
  }

  const wireResult = await executeResolved(finalResolved, { silentStatus: options.silentStatus });

  // ── TOTP cooldown record ───────────────────────────────────────
  // Only record on a successful round-trip — a fetch that never
  // reached the wire (DNS failure, CORS reject) didn't actually
  // burn the code with the provider. Recording too eagerly would
  // turn a transient network blip into an avoidable Ns wait.
  if (wireResult.error == null && outcome.totpUsed.length > 0) {
    const workspaceId = options.workspaceId ?? getActiveWorkspaceId();
    for (const usage of outcome.totpUsed) {
      recordTotpUsage(workspaceId, usage.name, usage.code, usage.period);
    }
  }

  // ── Post-response script hook ──────────────────────────────────
  if (
    !options.skipScripts &&
    request.postResponseScript?.trim() &&
    isOffscreenSupported() &&
    wireResult.error == null
  ) {
    const responseSnap: ResponseSnapshot = {
      status: wireResult.status,
      statusText: wireResult.statusText,
      url: wireResult.url,
      headers: wireResult.headers,
      body: wireResult.body,
      durationMs: wireResult.durationMs,
    };
    const result = await runScript({
      kind: 'post-response',
      source: request.postResponseScript,
      request: resolvedToSnapshot(finalResolved),
      response: responseSnap,
    });
    scriptOutcome = {
      ...(scriptOutcome ?? {}),
      postResponse: {
        succeeded: result.succeeded,
        error: result.error ? { name: result.error.name, message: result.error.message } : undefined,
        assertions: result.assertions,
        consoleLog: result.consoleLog,
        durationMs: result.durationMs,
      },
    };
  }

  return scriptOutcome ? { ...wireResult, scripts: scriptOutcome } : wireResult;
}

// Register the executor with the offscreen host so `oh.sendRequest`
// calls can route through our resolve + fetch pipeline. Done once at
// module eval — idempotent if called again.
__setExecuteRequestDraft(executeRequestDraft);

// ── Script integration helpers ─────────────────────────────────────

function resolvedToSnapshot(req: ResolvedRequest): RequestSnapshot {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers.map((h) => ({ key: h.key, value: h.value })),
    // Resolved query params (structured, pre-URL-fold) — the script
    // reads these off `oh.request.params` and can replace them via a
    // `params` mutation. The auth-injected query entries (api-key /
    // oauth2 `sendAs:'query'`) are included, mirroring how the
    // auth-injected `Authorization` header rides `headers`.
    params: req.params.map((p) => ({ key: p.key, value: p.value })),
    // The body is already a discriminated-union value; pass it through
    // verbatim so the script sandbox sees the same shape we'll send.
    body: req.body,
  };
}

function applyMutation(target: ResolvedRequest, mutation: RequestMutation): void {
  if (mutation.method) target.method = mutation.method;
  if (mutation.url) target.url = mutation.url;
  if (mutation.headers) target.headers = mutation.headers.map((h) => ({ key: h.key, value: h.value }));
  // Params are a full-list replacement (same contract as headers). The
  // structured list still gets folded into the URL at the wire, so a
  // script-set param reaches the server exactly like a user-set one.
  if (mutation.params) target.params = mutation.params.map((p) => ({ key: p.key, value: p.value }));
  // Body mutations are discriminated unions in their own right — assign
  // the whole new shape rather than cherry-picking fields. Any field
  // not on the chosen variant simply doesn't exist on the new value.
  if (mutation.body) {
    target.body = mutation.body;
    // Content-Type was derived from the PRE-script body during resolve —
    // re-derive it for the script-set shape (same skip rules: form gets
    // it from the URLSearchParams path, multipart from the browser's
    // boundary) unless an explicit header is present.
    if (!target.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
      const ct = defaultContentType(mutation.body);
      if (ct) target.headers.push({ key: 'Content-Type', value: ct });
    }
  }
}
