/**
 * Live gRPC stream relay — the browser SW's face of a forwarded
 * streaming invoke's live leg. The companion fans `grpcStreamEvent`
 * frames to the calling user's WS peers while a forwarded
 * `executeGrpcRequest` streams; this SW is such a peer, so the relay
 * claims those frames off the backend wire and re-broadcasts the
 * payload on the chrome-runtime broadcast `useLiveGrpcStream`
 * subscribes to — the web tab's `wire-grpc-stream.ts` twin.
 *
 * No state lives here: frames are display-only hints the resolving RPC
 * supersedes — the hook's own `sendId` + `seq` guards drop foreign and
 * stale frames, so a malformed or late frame just gets dropped.
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import { registerInboundFrameHandler } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { broadcast } from '@utils/bridge';

const FRAME_TYPE = 'grpcStreamEvent';

/**
 * Attempt to claim one inbound backend frame. Returns `true` when the
 * frame type matched (a malformed frame is still ours to drop), `false`
 * so the router tries the next handler otherwise.
 */
export function handleIncomingGrpcStreamFrame(frame: unknown): boolean {
  if (!frame || typeof frame !== 'object' || (frame as { type?: unknown }).type !== FRAME_TYPE) return false;
  const payload = (frame as { payload?: unknown }).payload;
  if (payload && typeof payload === 'object') {
    broadcast(FRAME_TYPE, payload as GrpcStreamEventWire);
  }
  return true;
}

let installed = false;

/** Idempotent — wired once from the SW boot spine. */
export function installGrpcStreamRelay(): void {
  if (installed) return;
  installed = true;
  registerInboundFrameHandler(handleIncomingGrpcStreamFrame);
}
