/**
 * The workbench HTTP routes — `executeRequest` and
 * `executeGraphqlRequest` — the ONE host-neutral answer every host
 * that runs the send's EXECUTOR gives (the daemon and the desktop app
 * through the node spine, the web tab as its own context), over the
 * host seam in `host.ts`: the same bridge channel the extension SW
 * handles, over the same host-neutral orchestration every send rides
 * (`runStepRequest` / `runInteractiveSend`: resolve → TOTP cooldown
 * gate → wire → cooldown record, scripts around the wire), so every
 * per-request knob and the cookie jar behave identically to a chain
 * or MCP send.
 *
 * Scripts run when the seam resolves a runner for the send: the run
 * rides the interactive pipeline — LENIENT script semantics, the SW's
 * `executeRequestDraft` twin: a script failure or failed assertion is
 * recorded on the snapshot, never mapped onto the run's error — and
 * the snapshot carries `scripts` with the execution mode stamped
 * (snapshot attribution, never a live-settings read). A seam without
 * a runner, or a request whose ancestor chain carries no script, keeps
 * the step runner — behavior-identical when no script runs. An
 * expired OAuth bundle refreshes at the token endpoint before
 * attaching, over the send's own transport (the host-neutral refresh
 * runner): a recoverable refresh failure attaches the stale bundle
 * and lets the target's 401 speak.
 *
 * The pin rules are every execute route's (`execute-route-scope.ts`):
 * unpinned on this host's runtime-Active workspace (the Active-bound
 * mirrors carry the environment pointer), pinned on a foreign one (a
 * peer-forwarded frame — its scripts run Safe unconditionally), and
 * pinned env-free on an explicit `environmentId: null`. The frame's
 * `executionPlace` names the backend the seam DELEGATES the socket to
 * — the peer plane strips it off a peer's frame before it reaches a
 * route, so a context send from a peer never hops onward.
 *
 * Result discipline: a run that fails before or on the wire resolves
 * `success: true` with an error SNAPSHOT — the response surface
 * renders `snapshot.error` — and `success: false` is reserved for
 * missing input and unexpected throws, mirroring the extension SW
 * handler. A frame carrying a `sendId` runs in streaming capture mode:
 * live `requestStreamEvent` frames go to the seam's sink while the
 * body streams in, and `abortRequestSend` can stop the exchange (the
 * host-neutral registry in `send-stream`).
 */

import { GraphqlRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedRequestSnapshot, GraphqlRequest, Request } from '@openheaders/core/types';
import { getRequest } from '../../entity/request-store';
import { hostStorage, wsKeys } from '../../storage';
import {
  type ExecuteRunScope,
  executeRouteScope,
  NO_ACTIVE_WORKSPACE_MESSAGE,
  pinExecuteScope,
} from '../execute-route-scope';
import { compileGraphqlRequest } from '../graphql-exec/execute';
import { type ExecuteStreamOptions, errorSnapshot } from '../request-exec/execute';
import { buildRefreshOAuthHook } from '../request-exec/oauth-refresh';
import { runInteractiveSend } from '../request-exec/run-interactive-send';
import { runStepRequest } from '../request-exec/run-step-request';
import { collectScriptChain } from '../request-exec/script-chain';
import type { RequestRouteHost } from './host';

export interface ExecuteRequestRouteResult {
  success: boolean;
  snapshot?: ExecutedRequestSnapshot;
  error?: string;
}

/** One `executeRequest` frame. `requestUid` takes precedence over
 *  `draft` (the channel contract). */
export async function executeRequestRoute(
  message: Record<string, unknown>,
  host: RequestRouteHost,
): Promise<ExecuteRequestRouteResult> {
  const requestUid = typeof message.requestUid === 'string' ? message.requestUid : undefined;
  const draft = message.draft as Request | undefined;
  let request: Request | undefined;
  if (requestUid) {
    const loaded = getRequest(requestUid);
    if (!loaded) return { success: true, snapshot: errorSnapshot(`Request ${requestUid} not found`) };
    request = loaded;
  } else {
    request = draft;
  }
  if (!request) return { success: false, error: 'No request or draft provided' };
  const pinned = pinExecuteScope(executeRouteScope(message));
  if (pinned === null) return { success: true, snapshot: errorSnapshot(NO_ACTIVE_WORKSPACE_MESSAGE) };
  return runRequestRoute(request, message, pinned, host);
}

/** One `executeGraphqlRequest` frame. `graphqlRequestUid` takes
 *  precedence over `draft`; `operationName` overrides the stored pick
 *  for this send. The entity loads from the read workspace's storage
 *  slot and compiles ONCE into its HTTP send (`compileGraphqlRequest`:
 *  one POST, the SAME uid + path so the ancestor chain resolves
 *  unchanged); the result IS an HTTP snapshot. */
export async function executeGraphqlRequestRoute(
  message: Record<string, unknown>,
  host: RequestRouteHost,
): Promise<ExecuteRequestRouteResult> {
  const graphqlRequestUid = typeof message.graphqlRequestUid === 'string' ? message.graphqlRequestUid : undefined;
  const draft = message.draft as GraphqlRequest | undefined;
  const operationName = typeof message.operationName === 'string' ? message.operationName : undefined;
  try {
    const pinned = pinExecuteScope(executeRouteScope(message));
    if (pinned === null) return { success: true, snapshot: errorSnapshot(NO_ACTIVE_WORKSPACE_MESSAGE) };
    let entity: GraphqlRequest | undefined;
    if (graphqlRequestUid) {
      const all = await hostStorage.getValidatedArray(
        wsKeys(pinned.readWorkspaceId).graphqlRequests,
        GraphqlRequestSchema,
      );
      const loaded = all.find((r) => r.uid === graphqlRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorSnapshot(`GraphQL request ${graphqlRequestUid} not found`) };
      }
      entity = loaded;
    } else {
      entity = draft;
    }
    if (!entity) return { success: false, error: 'No GraphQL request or draft provided' };
    const compiled = compileGraphqlRequest(entity, operationName !== undefined ? { operationName } : {});
    return await runRequestRoute(compiled, message, pinned, host);
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * The run leg both routes share: the seam's transport for the frame's
 * place, the script-capability gate over the request's ancestor chain,
 * the interactive vs step runner, the mode stamp.
 */
async function runRequestRoute(
  request: Request,
  message: Record<string, unknown>,
  pinned: ExecuteRunScope,
  host: RequestRouteHost,
): Promise<ExecuteRequestRouteResult> {
  const scope = executeRouteScope(message);
  const { workspaceId, readWorkspaceId, forwarded } = pinned;
  const stream: ExecuteStreamOptions | undefined =
    scope.sendId !== undefined ? { sendId: scope.sendId, emitFrame: host.emitStreamEvent } : undefined;
  try {
    const transport = host.transportFor(scope.placeBackendId, readWorkspaceId);
    // The gate spans the full ancestor-first chain — a request with no
    // own scripts still runs its collection's/folder's slots.
    const chain = collectScriptChain(request, workspaceId);
    const hasScripts = chain.pre.length > 0 || chain.post.length > 0;
    const resolved =
      hasScripts && host.resolveScriptRunner !== undefined
        ? await host.resolveScriptRunner({ workspaceId: readWorkspaceId, forwarded })
        : null;
    // Refresh-on-expired against the workspace the run resolves in —
    // the unpinned (null) dispatch reads and persists through the
    // runtime-Active workspace's store, same as the resolver.
    const refreshOAuth = buildRefreshOAuthHook(workspaceId ?? undefined, transport);
    const snapshot = resolved
      ? await runInteractiveSend(request, {
          workspaceId,
          environmentId: scope.environmentId,
          transport,
          scriptRunner: resolved.runner,
          refreshOAuth,
          ...(stream !== undefined ? { stream } : {}),
        })
      : await runStepRequest(request, {
          workspaceId,
          environmentId: scope.environmentId,
          transport,
          refreshOAuth,
          ...(stream !== undefined ? { stream } : {}),
        });
    const stamped =
      resolved && snapshot.scripts ? { ...snapshot, scripts: { ...snapshot.scripts, mode: resolved.mode } } : snapshot;
    return { success: true, snapshot: stamped };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
