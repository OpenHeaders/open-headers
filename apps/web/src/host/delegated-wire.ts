/**
 * The web tab's delegated wire — the two seams a delegating transport
 * rides (`DelegatedWire` for the request family; the socket family's
 * `DelegatedSocketWire` joins with the sessions slice), implemented
 * over the tab's ONE wire to its serving daemon: the frame goes up as
 * a wire RPC (`callWireRpc`, correlated by channel), the daemon fans
 * the send's live `requestStreamEvent` frames to this user's peers
 * and the claim below routes them to the transport that minted the
 * send id, the Stop rider forwards as `abortRequestSend`. The tab has
 * no backend connection manager — this is the connection manager's
 * `delegated-wire-client.ts` shape over `wire-rpc.ts` + the inbound
 * router, nothing more.
 *
 * The wait for the place's answer follows the request's own timeout
 * knob (plus transit slack), the forwarded Send's rule before Phase W
 * — the wire correlates by channel and a send may legitimately run
 * long. Two delegated sends serialize on the channel (the wire's
 * one-in-flight-per-channel law); the second waits for the first.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import { DELEGATE_REQUEST_CHANNEL } from '@openheaders/core/protocol';
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

const FRAME_TYPE = 'requestStreamEvent';

registerWireRpcChannels([DELEGATE_REQUEST_CHANNEL, 'abortRequestSend']);

/** The transports' claims by the send id each minted. */
const claimsBySendId = new Map<string, (event: RequestStreamEventWire) => void>();

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

/** Drop every claim — test isolation only. */
export function __resetDelegatedWireForTests(): void {
  claimsBySendId.clear();
}
