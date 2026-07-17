/**
 * Live gRPC stream mirror — the web tab's face of a forwarded
 * streaming invoke's live leg, the `wire-request-stream.ts` twin. The
 * serving daemon fans `grpcStreamEvent` frames to the calling user's
 * WS peers while a forwarded `executeGrpcRequest` streams; this tab is
 * such a peer, so the mirror claims those frames off the single wire
 * and re-broadcasts the payload into the in-tab fan-out
 * `useLiveGrpcStream` subscribes to.
 *
 * No state lives here: frames are display-only hints the resolving RPC
 * supersedes — the hook's own `sendId` + `seq` guards drop foreign and
 * stale frames, so a malformed or late frame just gets dropped.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { broadcastLocal } from './web-broadcast';

const SCOPE = 'WireGrpcStream';

const FRAME_TYPE = 'grpcStreamEvent';

interface GrpcStreamFrame {
  type: string;
  payload: { sendId: string; seq: number; kind: string };
}

function isGrpcStreamFrame(raw: unknown): raw is GrpcStreamFrame {
  const payload = (raw as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return false;
  const { sendId, seq, kind } = payload as { sendId?: unknown; seq?: unknown; kind?: unknown };
  return typeof sendId === 'string' && typeof seq === 'number' && typeof kind === 'string';
}

/**
 * Attempt to handle one parsed wire frame. Returns `true` if the frame
 * type matched (a malformed frame is still ours to drop), `false`
 * otherwise so the caller routes it onward.
 */
export function handleIncomingGrpcStreamFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== FRAME_TYPE) return false;
  if (!isGrpcStreamFrame(raw)) {
    logger.debug(SCOPE, `dropping malformed ${FRAME_TYPE} frame`);
    return true;
  }
  broadcastLocal(FRAME_TYPE, raw.payload);
  return true;
}
