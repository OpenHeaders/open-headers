/**
 * Workbench `executeRequest` route — the node host's user-facing Send.
 * Answers the same bridge channel the extension SW handles, over the
 * same host-neutral orchestration every node send rides
 * (`runStepRequest`: resolve → TOTP cooldown gate → wire → cooldown
 * record), so every per-request knob and the cookie jar behave
 * identically to a chain or MCP send.
 *
 * Scripts run when the host shell registered a script runtime (the
 * desktop's brokers via `setHostScriptCapabilities`):
 * the run rides the host-neutral `StepScriptRunner` port, the snapshot
 * carries `scripts` with the execution mode stamped, and the response
 * surface renders it exactly as the extension does. A host without the
 * capability (the headless daemon) stays scriptless — `snapshot
 * .scripts` stays null and the surface degrades cleanly. A
 * peer-forwarded send (frame stamped with a foreign workspace) still
 * runs scripts, but only ever Safe — it never consults this host's
 * mode slot. An expired OAuth bundle refreshes at the token endpoint
 * before attaching (the host-neutral refresh runner, the extension's
 * exact semantics): a recoverable refresh failure attaches the stale
 * bundle and lets the target's 401 speak, never failing the run. No
 * rate limiter on the SEND itself — a user-initiated Send is
 * deliberate, matching the extension's user-facing executor — while
 * the refresh POST inside pays the shared per-origin token bucket,
 * exactly as it does everywhere.
 *
 * Runs unpinned (`workspaceId: null`) when the caller's workspace is
 * this host's runtime-Active one (or unstated) — the run resolves
 * against the Active-bound module mirrors, which carry the active
 * environment pointer and the Active live registry for `{{live.*}}`.
 * A forwarded send stamped with a DIFFERENT workspace runs pinned, the
 * chain-dispatch path: explicit env, per-workspace scopes, and the
 * documented `{{live.*}}` degradation under a null env.
 *
 * `environmentId` is tri-state on the channel: absent defers to this
 * host's pointer (the unpinned run's mirrors carry it), a string pins
 * that env, and explicit `null` is the caller's "No environment" state.
 * An explicit none forces the PINNED dispatch even for the active
 * workspace — the Active mirrors ARE the state the caller turned off
 * (their live registry keys `{{live.*}}` rows on this host's active
 * env), while the pinned scope resolves env-free with the
 * `(workspace, null)` live mirror, exactly the caller's own view.
 */

import { hostBridge, type RequestStreamEventWire } from '@openheaders/core/bridge';
import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { getRequest } from '@openheaders/oracle/entity/request-store';
import { type ExecuteStreamOptions, errorSnapshot } from '@openheaders/oracle/live/request-exec/execute';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { runInteractiveSend } from '@openheaders/oracle/live/request-exec/run-interactive-send';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import { collectScriptChain } from '@openheaders/oracle/live/request-exec/script-chain';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { resolveScriptRunner } from './script-capability';

export interface ExecuteRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedRequestSnapshot;
  error?: string;
}

// Stateless wrapper — the dispatcher cache and cookie-jar registry are
// module-global in the transport layer, so this instance shares every
// agent tuple and jar with the chain runner's and the MCP tools'.
const nodeTransport = createNodeRequestTransport();

/**
 * Default live-frame sink for an in-process caller — the host's local
 * broadcast (desktop: `webContents.send` to every open renderer). A
 * peer-forwarded send passes its own sink instead, so frames reach the
 * CALLING surface across the backend wire (see `peer-requests-rpc.ts`).
 */
function broadcastStreamFrameLocally(event: RequestStreamEventWire): void {
  hostBridge.broadcast('requestStreamEvent', event);
}

/**
 * Handle one `executeRequest` bridge message. `requestUid` takes
 * precedence over `draft` (the channel contract); a run that fails
 * before or on the wire still resolves `success: true` with an error
 * snapshot — the response surface renders `snapshot.error` — and
 * `success: false` is reserved for missing input and unexpected throws,
 * mirroring the extension SW handler.
 *
 * A frame carrying a `sendId` runs in streaming capture mode: live
 * `requestStreamEvent` frames go to `emitStreamFrame` while the body
 * streams in, and `abortRequestSend` can stop the exchange (the
 * host-neutral registry in oracle's `send-stream`).
 */
export async function handleExecuteRequestRpc(
  message: Record<string, unknown>,
  transport: RequestTransport = nodeTransport,
  emitStreamFrame: (event: RequestStreamEventWire) => void = broadcastStreamFrameLocally,
): Promise<ExecuteRequestRpcResult> {
  const requestUid = typeof message.requestUid === 'string' ? message.requestUid : undefined;
  const draft = message.draft as Request | undefined;
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  const stream: ExecuteStreamOptions | undefined =
    sendId !== undefined ? { sendId, emitFrame: emitStreamFrame } : undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const requestedWorkspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
  const workspaceId =
    requestedWorkspaceId !== undefined && requestedWorkspaceId !== getActiveWorkspaceId()
      ? requestedWorkspaceId
      : environmentId === null
        ? getActiveWorkspaceId()
        : null;

  let request: Request | undefined;
  if (requestUid) {
    const loaded = getRequest(requestUid);
    if (!loaded) return { success: true, snapshot: errorSnapshot(`Request ${requestUid} not found`) };
    request = loaded;
  } else {
    request = draft;
  }
  if (!request) return { success: false, error: 'No request or draft provided' };

  try {
    // A frame stamped with a foreign workspace is a peer-forwarded send
    // — its scripts run Safe unconditionally (never this host's slot).
    const forwarded = requestedWorkspaceId !== undefined && requestedWorkspaceId !== getActiveWorkspaceId();
    // The gate spans the full ancestor-first chain — a request with no
    // own scripts still runs its collection's/folder's slots.
    const chain = collectScriptChain(request, workspaceId);
    const hasScripts = chain.pre.length > 0 || chain.post.length > 0;
    const resolved = hasScripts
      ? await resolveScriptRunner({
          workspaceId: workspaceId ?? getActiveWorkspaceId(),
          hostContext: 'interactive',
          forwarded,
        })
      : null;
    // With a script runtime, the send rides the interactive pipeline —
    // LENIENT script semantics, the SW's `executeRequestDraft` twin: a
    // script failure or failed assertion is recorded on the snapshot,
    // never mapped onto the run's error. Scriptless sends (and hosts
    // without the capability, the headless daemon) keep the step
    // runner — behavior-identical when no script runs.
    // Refresh-on-expired against the workspace the run resolves in —
    // the unpinned (null) dispatch reads and persists through the
    // runtime-Active workspace's store, same as the resolver.
    const refreshOAuth = buildRefreshOAuthHook(workspaceId ?? undefined, transport);
    const snapshot = resolved
      ? await runInteractiveSend(request, {
          workspaceId,
          environmentId,
          transport,
          scriptRunner: resolved.runner,
          refreshOAuth,
          ...(stream !== undefined ? { stream } : {}),
        })
      : await runStepRequest(request, {
          workspaceId,
          environmentId,
          transport,
          refreshOAuth,
          ...(stream !== undefined ? { stream } : {}),
        });
    // Stamp the mode the scripted portion actually ran under — snapshot
    // attribution, never a live-settings read (the SSL-off precedent).
    const stamped =
      resolved && snapshot.scripts ? { ...snapshot, scripts: { ...snapshot.scripts, mode: resolved.mode } } : snapshot;
    return { success: true, snapshot: stamped };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
