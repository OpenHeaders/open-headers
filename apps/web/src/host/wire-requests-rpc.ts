/**
 * Workbench gRPC channels over the web tab's single wire —
 * `executeGrpcRequest` with its upstream riders `sendGrpcStreamMessage`
 * / `endGrpcClientStream` travel to the serving daemon and answer from
 * its spine as CONTEXT sends (the tab oracle has no HTTP/2 stack; the
 * daemon resolves the invoke against its own workspace). The daemon's
 * live `grpcStreamEvent` frames for a forwarded invoke come back down
 * the same wire — `wire-grpc-stream.ts` claims them.
 *
 * The HTTP send left this seam at the Execution Place plan's Phase W:
 * `executeRequest` / `executeGraphqlRequest`, the Stop and the
 * cookie-jar trio answer IN the tab (`tab-requests-rpc.ts` — the tab
 * is the context, the daemon only opens the socket).
 *
 * The daemon resolves an unstated workspace to ITS runtime-Active one
 * and an unstated environment to ITS active pointer — both host-local
 * state that can differ from this tab's. So the forwarding seam stamps
 * the TAB's active workspace id and active environment id before the
 * frame leaves; the daemon runs unpinned when the stamped workspace
 * matches its own active one and pinned (the chain-dispatch path)
 * otherwise. The environment stamp is verbatim tri-state: the tab's
 * pointer is `string | null`, and `null` — the selectable "No
 * environment" state — rides the frame explicitly so the daemon runs
 * env-free instead of deferring to its own pointer. Only a tab that
 * doesn't know its workspace omits both stamps (full defer).
 *
 * A refused/failed Invoke resolves as an error SNAPSHOT (`success:
 * true` + `snapshot.error`, the S13 error contract) so the response
 * pane states what happened — the daemon's opt-in refusal rides here
 * verbatim.
 */

import type { ExecutedGrpcSnapshot } from '@openheaders/core/types';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { errorGrpcSnapshot } from '@openheaders/oracle/live/grpc-exec/execute';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { callWireRpc, registerWireRpcChannels } from './wire-rpc';

/** Wire wait for a forwarded Invoke when the draft carries no timeout knob. */
const EXECUTE_DEFAULT_TIMEOUT_MS = 120_000;
/** Slack past the request's own timeout for daemon-side resolve + transit. */
const EXECUTE_TIMEOUT_MARGIN_MS = 15_000;

const FORWARDED_CHANNELS = ['executeGrpcRequest', 'sendGrpcStreamMessage', 'endGrpcClientStream'] as const;

registerWireRpcChannels(FORWARDED_CHANNELS);

export function isForwardedRequestsChannel(type: unknown): type is (typeof FORWARDED_CHANNELS)[number] {
  return typeof type === 'string' && (FORWARDED_CHANNELS as readonly string[]).includes(type);
}

/** Stamp the tab's active workspace unless the caller already scoped one. */
function withWorkspaceStamp(message: Record<string, unknown>): Record<string, unknown> {
  if (typeof message.workspaceId === 'string') return message;
  const workspaceId = peekActiveWorkspaceId();
  return workspaceId ? { ...message, workspaceId } : message;
}

interface ExecuteGrpcRequestResult {
  success: boolean;
  snapshot?: ExecutedGrpcSnapshot;
  error?: string;
}

/** The gRPC Invoke's forwarding — the tab's stamps, the margin, the
 *  error-snapshot degrade (the response pane states what happened). */
async function forwardExecuteGrpcRequest(message: Record<string, unknown>): Promise<ExecuteGrpcRequestResult> {
  const stamped = { ...withWorkspaceStamp(message) };
  // Verbatim tri-state stamp: the tab's pointer is string | null, and
  // null (No environment) must reach the daemon explicitly. The pointer
  // only has meaning relative to a workspace, so a frame with no
  // workspace scope omits the env stamp too — full defer.
  if (stamped.environmentId === undefined && typeof stamped.workspaceId === 'string') {
    stamped.environmentId = getActiveEnvironmentId();
  }
  const draft = stamped.draft as { timeoutMs?: number } | undefined;
  const timeoutMs =
    (typeof draft?.timeoutMs === 'number' ? draft.timeoutMs : EXECUTE_DEFAULT_TIMEOUT_MS) + EXECUTE_TIMEOUT_MARGIN_MS;
  try {
    return (await callWireRpc(stamped, { timeoutMs })) as ExecuteGrpcRequestResult;
  } catch (err) {
    return { success: true, snapshot: errorGrpcSnapshot((err as Error).message) };
  }
}

/**
 * Forward one workbench gRPC channel up the wire. Only call for
 * channels {@link isForwardedRequestsChannel} owns.
 */
export async function forwardRequestsRpc(message: Record<string, unknown>): Promise<unknown> {
  if (message.type === 'executeGrpcRequest') {
    return forwardExecuteGrpcRequest(message);
  }
  return callWireRpc(withWorkspaceStamp(message));
}
