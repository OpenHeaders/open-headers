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
import type { LiveWsSession } from '../websocket-request-editor/useLiveWsSession';

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
