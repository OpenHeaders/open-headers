/**
 * The subscription's protocol state as the display reads it — the core
 * `graphql-transport-ws` client machine replayed over the session's
 * frames (the SAME reducer the executing host drove; the capture is
 * the truth, the display decodes it). Live: incremental over the
 * append-only `wsStreamEvent` log — each committed frame reduces
 * once, the running state is cached beside the log's identity, so a
 * chatty subscription costs one step per frame, never a replay per
 * commit. Settled: one replay over the snapshot's capture, memoized
 * per snapshot.
 */

import {
  decodeGraphqlWsClientMessage,
  GRAPHQL_WS_INITIAL_STATE,
  type GraphqlWsClientState,
  reduceGraphqlWsClient,
  replayGraphqlWsCapture,
} from '@openheaders/core/graphql';
import type { ExecutedWsSnapshot } from '@openheaders/core/types';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { useMemo, useRef } from 'react';
import type { PillTone } from '../request-editor/response/response-status';
import type { SendPulseDrive } from '../request-editor/response/send-pulse';
import type { LiveWsSession, WsSessionTiming } from '../websocket-request-editor/useLiveWsSession';
import { wsSessionEndTone } from '../websocket-request-editor/ws-lifecycle';

interface LiveAccumulator {
  /** The append-only log the running state was reduced over. */
  items: LiveWsSession['items'];
  /** Frames reduced so far — the next commit resumes here. */
  consumed: number;
  state: GraphqlWsClientState;
}

const decoder = new TextDecoder();

/** A captured frame's text; a malformed payload decodes to nothing
 *  (the machine ignores what is not a protocol frame). */
function frameText(dataBase64: string): string {
  return decoder.decode(decodeBase64Bytes(dataBase64) ?? new Uint8Array(0));
}

function reduceFrame(
  state: GraphqlWsClientState,
  frame: { direction: 'up' | 'down'; dataBase64: string; binary: boolean },
): GraphqlWsClientState {
  if (frame.binary) return state;
  const text = frameText(frame.dataBase64);
  if (frame.direction === 'down') return reduceGraphqlWsClient(state, { kind: 'message', text }).state;
  return decodeGraphqlWsClientMessage(text)?.type === 'complete'
    ? reduceGraphqlWsClient(state, { kind: 'stop' }).state
    : state;
}

/** The subscription's state for the pane — the settled snapshot's
 *  replay once it exists, else the live log reduced incrementally. */
export function useGraphqlSubscriptionState(
  live: LiveWsSession | null,
  snapshot: ExecutedWsSnapshot | null,
): GraphqlWsClientState {
  const liveRef = useRef<LiveAccumulator | null>(null);
  const settled = useMemo(
    () =>
      snapshot === null
        ? null
        : replayGraphqlWsCapture(
            snapshot.outcome.kind === 'connected',
            snapshot.messages.flatMap((m) =>
              m.binary ? [] : [{ direction: m.direction, text: frameText(m.dataBase64) }],
            ),
            snapshot.close,
          ),
    [snapshot],
  );
  if (settled !== null) {
    liveRef.current = null;
    return settled;
  }
  if (live === null) {
    liveRef.current = null;
    return GRAPHQL_WS_INITIAL_STATE;
  }
  // A new session's log is a new identity — the running state starts
  // over; the same log resumes where the last commit left off.
  const acc =
    liveRef.current !== null && liveRef.current.items === live.items
      ? liveRef.current
      : { items: live.items, consumed: 0, state: GRAPHQL_WS_INITIAL_STATE };
  let state = acc.state;
  // The open frame lands before any message — the seed commit (the
  // "Connecting" row) precedes it, so the open step waits for it here.
  if (state.phase === 'idle' && live.open !== null) state = reduceGraphqlWsClient(state, { kind: 'open' }).state;
  for (let i = acc.consumed; i < live.count; i++) state = reduceFrame(state, live.items[i]);
  acc.consumed = live.count;
  acc.state = state;
  liveRef.current = acc;
  return state;
}

/** The subscription's own tone — the phase tag's, and what the pane's
 *  send pulse paints: the server's `error` or its own Close on the
 *  error tint, the client's Stop neutral, a live subscription on the
 *  info tint (the gRPC STREAMING badge's), one the server completed
 *  on success; neutral before any of that. */
export function graphqlSubscriptionTone(state: GraphqlWsClientState): PillTone {
  if (state.phase === 'errored' || (state.phase === 'closed' && state.close !== null)) return 'error';
  if (state.stopped) return 'neutral';
  return state.phase === 'subscribed' ? 'info' : state.phase === 'completed' ? 'success' : 'neutral';
}

/** The socket pill's tone under a subscription: the executor closes
 *  the socket itself after the server's `complete` or `error` and
 *  after a Stop, so a connected session whose Close is on record
 *  reads neutral unless the SERVER closed it before the protocol
 *  ended (the 4xxx codes); a handshake that never settled, a cancel
 *  before it and a severed socket keep the socket's own reading. */
export function graphqlSubscriptionEndTone(
  state: GraphqlWsClientState,
  snapshot: ExecutedWsSnapshot,
  timing: Pick<WsSessionTiming, 'closeRequestedAt'> | null,
): PillTone {
  if (snapshot.outcome.kind !== 'connected' || snapshot.close === null) return wsSessionEndTone(snapshot, timing);
  return state.phase === 'closed' ? 'error' : 'neutral';
}

/** The pane's send-pulse drive under a subscription: in flight until
 *  the server acknowledges the subscription (dial, init, ack), then
 *  resting on the subscription's own tone — the server's `complete`
 *  or `error` lands while the socket is still open, and the settle
 *  that follows keeps that landing, so the end plays once. Where the
 *  protocol never got to speak (a handshake that failed, a cancel
 *  before the ack, a socket severed mid-subscription) the socket's
 *  own reading lands. */
export function graphqlSubscriptionPulse(
  state: GraphqlWsClientState,
  live: LiveWsSession | null,
  snapshot: ExecutedWsSnapshot | null,
  timing: Pick<WsSessionTiming, 'closeRequestedAt'> | null,
): SendPulseDrive {
  if (snapshot !== null) {
    const protocolEnded = state.phase === 'completed' || state.phase === 'errored' || state.phase === 'closed';
    return {
      inflight: false,
      landing:
        snapshot.outcome.kind === 'connected' && protocolEnded
          ? graphqlSubscriptionTone(state)
          : wsSessionEndTone(snapshot, timing),
    };
  }
  if (live === null) return { inflight: false, landing: null };
  return state.phase === 'idle' || state.phase === 'connecting'
    ? { inflight: true, landing: null }
    : { inflight: false, landing: graphqlSubscriptionTone(state) };
}
