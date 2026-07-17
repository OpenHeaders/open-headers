/**
 * gRPC forwarding RPCs — the browser SW has no HTTP/2 stack that
 * surfaces trailers, so the GrpcRequest executor channels forward over
 * the backend wire to a connected companion (the desktop app / daemon),
 * which answers them on its operator-gated peer plane
 * (`peer-requests-rpc.ts`). The migration `getState` forwarding
 * precedent, applied to the invoke plane.
 *
 * Stamping mirrors the web tab's forwarding seam verbatim: the
 * companion resolves an unstated workspace to ITS runtime-Active one
 * and an unstated environment to ITS active pointer — both host-local
 * state that can differ from this browser's. So `executeGrpcRequest`
 * stamps this SW's active workspace id and tri-state environment
 * pointer before the frame leaves (`null` — the selectable "No
 * environment" state — rides explicitly).
 *
 * Degradation is per surface: a refused/failed Invoke resolves as an
 * error SNAPSHOT (`success: true` + `snapshot.error`, the S13 error
 * contract) so the response pane states what happened. The upstream
 * riders answer `success: false` instead — their surface is a toast,
 * not the response pane. Live `grpcStreamEvent` frames for a forwarded
 * streaming invoke come back down the same wire —
 * `grpc-stream-relay.ts` claims them into the local broadcast.
 */

import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { errorGrpcSnapshot } from '@openheaders/oracle/live/grpc-exec/execute';
import { wsRequest } from '../../../ws-request';
import { getActiveWorkspaceId } from '../../workspace/workspace-store';
import type { HandlerMap } from '../types';

/** Wire wait for a forwarded Invoke when the draft carries no timeout knob. */
const EXECUTE_DEFAULT_TIMEOUT_MS = 120_000;
/** Slack past the call's own deadline for companion-side resolve + transit. */
const EXECUTE_TIMEOUT_MARGIN_MS = 15_000;

/** The wsRequest 'not-connected' rejection, translated for the response pane. */
const NO_COMPANION_MESSAGE = 'The desktop app is not connected. Connect it to invoke gRPC requests.';

function forwardedErrorMessage(err: Error): string {
  return err.message === 'not-connected' ? NO_COMPANION_MESSAGE : err.message;
}

export const grpcHandlers: HandlerMap = {
  executeGrpcRequest: ({ message, respond }) => {
    const draft = message.draft as { timeoutMs?: number } | undefined;
    const frame: { type: string } & Record<string, unknown> = { type: 'executeGrpcRequest' };
    if (typeof message.grpcRequestUid === 'string') frame.grpcRequestUid = message.grpcRequestUid;
    if (draft !== undefined) frame.draft = draft;
    if (typeof message.sendId === 'string') frame.sendId = message.sendId;
    // Workspace stamp: the caller's scope wins; else this SW's active
    // workspace. Environment stamp is verbatim tri-state and only
    // meaningful relative to a stamped workspace (the web seam's law).
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : getActiveWorkspaceId();
    if (workspaceId) {
      frame.workspaceId = workspaceId;
      frame.environmentId = message.environmentId !== undefined ? message.environmentId : getActiveEnvironmentId();
    }
    const timeoutMs =
      (typeof draft?.timeoutMs === 'number' ? draft.timeoutMs : EXECUTE_DEFAULT_TIMEOUT_MS) + EXECUTE_TIMEOUT_MARGIN_MS;
    wsRequest<{ success: boolean; snapshot?: unknown; error?: string }>(frame, { timeoutMs })
      .then((result) => respond(result))
      .catch((err: Error) => {
        // Honest degrade on the Invoke surface: the companion's refusal
        // (opt-in off, permission denied) or a dead wire renders as the
        // response pane's error state, never a silent null.
        respond({ success: true, snapshot: errorGrpcSnapshot(forwardedErrorMessage(err)) });
      });
    return true;
  },

  // Upstream riders for a forwarded client/bidi stream — sendId-keyed,
  // answered by the companion's active-stream registry.
  sendGrpcStreamMessage: ({ message, respond }) => {
    if (typeof message.sendId !== 'string' || typeof message.messageText !== 'string') {
      respond({ success: false, error: 'No stream id or message provided' });
      return;
    }
    wsRequest<{ success: boolean; error?: string }>({
      type: 'sendGrpcStreamMessage',
      sendId: message.sendId,
      messageText: message.messageText,
    })
      .then((result) => respond(result))
      .catch((err: Error) => respond({ success: false, error: forwardedErrorMessage(err) }));
    return true;
  },

  endGrpcClientStream: ({ message, respond }) => {
    if (typeof message.sendId !== 'string') {
      respond({ success: false });
      return;
    }
    wsRequest<{ success: boolean }>({ type: 'endGrpcClientStream', sendId: message.sendId })
      .then((result) => respond(result))
      .catch(() => respond({ success: false }));
    return true;
  },
};
