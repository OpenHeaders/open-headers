/**
 * The web tab's delegated wire — the two seams a delegating transport
 * rides (`DelegatedWire` for the request family, `DelegatedSocketWire`
 * for the socket family), implemented over the tab's ONE wire to its
 * serving daemon: a frame goes up as a wire RPC (`callWireRpc`,
 * correlated by channel), the daemon fans a send's live
 * `requestStreamEvent` frames and a socket's `delegatedSocketEvent`
 * frames to this user's peers, and the claims below route each to the
 * transport that minted the id (the send id, the socket id); the Stop
 * rider forwards as `abortRequestSend`, a socket's abort as
 * `delegateSocketAbort`. The tab has no backend connection manager —
 * this is the connection manager's `delegated-wire-client.ts` shape
 * over `wire-rpc.ts` + the inbound router, nothing more.
 *
 * The wait for the place's answer to a request follows the request's
 * own timeout knob (plus transit slack), the forwarded Send's rule
 * before Phase W — the wire correlates by channel and a send may
 * legitimately run long. A socket OPEN answers as soon as the place
 * registered the socket (the dial's outcome arrives as events), and
 * a rider as soon as the place wrote — both wait the riders' 15 s.
 * Two calls on one channel serialize (the wire's one-in-flight-per-
 * channel law); the second waits for the first.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import {
  DELEGATE_MQTT_OPEN_CHANNEL,
  DELEGATE_REQUEST_CHANNEL,
  DELEGATE_WS_OPEN_CHANNEL,
  DELEGATED_SOCKET_EVENT_FRAME,
  DELEGATED_SOCKET_RIDER_CHANNELS,
  type DelegatedSocketEvent,
} from '@openheaders/core/protocol';
import type { DelegatedSocketWire } from '@openheaders/oracle/live/delegated-socket/wire';
import type {
  DelegatedRequestFrame,
  DelegatedRequestResult,
} from '@openheaders/oracle/live/request-exec/delegated-wire';
import type { DelegatedWire } from '@openheaders/oracle/live/request-exec/delegating-transport';
import { callWireRpc, registerWireRpcChannels } from './wire-rpc';

/** Wire wait for a delegated send when the request carries no timeout knob. */
const DELEGATE_DEFAULT_TIMEOUT_MS = 120_000;
/** Slack past the request's own timeout for the place's dial + transit. */
const DELEGATE_TIMEOUT_MARGIN_MS = 15_000;
/** The socket family's wait — an OPEN answers on registration, a rider
 *  on the write (the connection manager's rule). */
const SOCKET_CALL_TIMEOUT_MS = 15_000;

const FRAME_TYPE = 'requestStreamEvent';

registerWireRpcChannels([
  DELEGATE_REQUEST_CHANNEL,
  'abortRequestSend',
  DELEGATE_WS_OPEN_CHANNEL,
  DELEGATE_MQTT_OPEN_CHANNEL,
  ...DELEGATED_SOCKET_RIDER_CHANNELS,
]);

/** The transports' claims by the send id each minted. */
const claimsBySendId = new Map<string, (event: RequestStreamEventWire) => void>();
/** The session transports' claims by the socket id each minted. */
const claimsBySocketId = new Map<string, (event: DelegatedSocketEvent) => void>();

function waitFor(frame: DelegatedRequestFrame): number {
  const own = frame.request.timeoutMs;
  return (typeof own === 'number' && own > 0 ? own : DELEGATE_DEFAULT_TIMEOUT_MS) + DELEGATE_TIMEOUT_MARGIN_MS;
}

/** The daemon's answer, structurally checked — a payload that is not
 *  the family's result shape reads as a dead answer. */
function asDelegatedResult(payload: unknown): DelegatedRequestResult {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const answer = payload as { success: unknown; response?: unknown; error?: unknown };
    if (answer.success === true && answer.response && typeof answer.response === 'object') {
      return payload as DelegatedRequestResult;
    }
    if (answer.success === false && typeof answer.error === 'string') return payload as DelegatedRequestResult;
  }
  throw new Error('The place gave no readable answer.');
}

/** The wire toward the serving daemon — the tab's one place. */
export const webDelegatedWire: DelegatedWire = {
  call: async (frame) => asDelegatedResult(await callWireRpc(frame, { timeoutMs: waitFor(frame) })),
  abort: (sendId) => {
    callWireRpc({ type: 'abortRequestSend', sendId }).catch(() => {});
  },
  subscribeFrames: (sendId, onFrame) => {
    claimsBySendId.set(sendId, onFrame);
    return () => {
      claimsBySendId.delete(sendId);
    };
  },
};

/**
 * Claim one inbound wire frame when it is a live frame of a delegated
 * send this tab's transport minted — routed to that transport's
 * observer, never re-broadcast (the context's own emitter re-emits
 * under the caller's send id). Every other frame passes onward,
 * including the `requestStreamEvent` frames of a forwarded gRPC
 * invoke, which the generic mirror claims after this.
 */
export function handleIncomingDelegatedStreamFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== FRAME_TYPE) return false;
  const payload = (raw as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return false;
  const sendId = (payload as { sendId?: unknown }).sendId;
  if (typeof sendId !== 'string') return false;
  const onFrame = claimsBySendId.get(sendId);
  if (onFrame === undefined) return false;
  onFrame(payload as RequestStreamEventWire);
  return true;
}

/** The socket wire toward the serving daemon — the delegating session
 *  transports' seam: the OPEN frames and the riders ride as wire RPCs,
 *  the place's events are claimed by socket id below. */
export const webDelegatedSocketWire: DelegatedSocketWire = {
  call: (frame) => callWireRpc(frame, { timeoutMs: SOCKET_CALL_TIMEOUT_MS }),
  subscribe: (socketId, onEvent) => {
    claimsBySocketId.set(socketId, onEvent);
    return () => {
      claimsBySocketId.delete(socketId);
    };
  },
};

/**
 * Claim one inbound wire frame when it is an event of a delegated
 * socket this tab's transport minted — routed to that transport,
 * consumed. The daemon fans a user's socket events to every peer of
 * theirs, so another tab's socket passes onward unclaimed.
 */
export function handleIncomingDelegatedSocketFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== DELEGATED_SOCKET_EVENT_FRAME)
    return false;
  const payload = (raw as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return false;
  const socketId = (payload as { socketId?: unknown }).socketId;
  if (typeof socketId !== 'string') return false;
  const onEvent = claimsBySocketId.get(socketId);
  if (onEvent === undefined) return false;
  onEvent(payload as DelegatedSocketEvent);
  return true;
}

/** Drop every claim — test isolation only. */
export function __resetDelegatedWireForTests(): void {
  claimsBySendId.clear();
  claimsBySocketId.clear();
}
