/**
 * Live-frame sinks for a send this host runs on a WS peer's behalf —
 * shared by both request families. Frames go back down the backend
 * wire to the CALLING user's connected peers (the same-user law the
 * awareness fan-out holds — the caller's surface filters by its minted
 * `sendId`; the user's other surfaces ignore unknown ids). The server
 * slot is re-read per frame so bind swaps flow through; frames are
 * display-only hints, so a dead slot just drops them.
 */

import type { GrpcStreamEventWire, RequestStreamEventWire } from '@openheaders/core/bridge';
import { getWsPeerServer } from './ws-peer-slot';

export function peerStreamFrameSink(userId: string): (event: RequestStreamEventWire) => void {
  return (event) => {
    getWsPeerServer()?.broadcastFrame(
      { type: 'requestStreamEvent', payload: event },
      { filterPeer: (peer) => peer.userId === userId },
    );
  };
}

/** The gRPC twin — `grpcStreamEvent` frames for a forwarded streaming
 *  invoke fan back under the same same-user law and drop-safety. */
export function peerGrpcStreamFrameSink(userId: string): (event: GrpcStreamEventWire) => void {
  return (event) => {
    getWsPeerServer()?.broadcastFrame(
      { type: 'grpcStreamEvent', payload: event },
      { filterPeer: (peer) => peer.userId === userId },
    );
  };
}
