/**
 * Live send-stream mirror — the web tab's face of a forwarded send's
 * streaming leg (F1). The serving daemon fans `requestStreamEvent`
 * frames to the calling user's WS peers while a forwarded
 * `executeRequest` body streams in; this tab is such a peer, so the
 * mirror claims those frames off the single wire and re-broadcasts the
 * payload into the in-tab fan-out `useLiveSendStream` subscribes to
 * (the same claim-and-rebroadcast posture as `wire-migration-mirror`).
 *
 * No state lives here: frames are display-only hints the resolving RPC
 * supersedes — the hook's own `sendId` + `seq` guards drop foreign and
 * stale frames, so a malformed or late frame just gets dropped.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { broadcastLocal } from './web-broadcast';

const SCOPE = 'WireRequestStream';

const FRAME_TYPE = 'requestStreamEvent';

interface RequestStreamFrame {
  type: string;
  payload: { sendId: string; seq: number; kind: string };
}

function isRequestStreamFrame(raw: unknown): raw is RequestStreamFrame {
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
export function handleIncomingRequestStreamFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== FRAME_TYPE) return false;
  if (!isRequestStreamFrame(raw)) {
    logger.debug(SCOPE, `dropping malformed ${FRAME_TYPE} frame`);
    return true;
  }
  broadcastLocal(FRAME_TYPE, raw.payload);
  return true;
}
