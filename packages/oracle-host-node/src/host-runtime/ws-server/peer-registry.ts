// ── Per-server connection registry ──────────────────────────────────
//
// One registry per started server — the shared connection state the
// per-socket handler, the heartbeat sweep, and the public API surface
// all read and mutate. Created inside `startOracleWsServer` so two
// servers (test rebinds) never share state.

import { hostLogger as logger } from '@openheaders/core/logger';
import type { PeerConnection } from '@openheaders/oracle/host-runtime/peer-connection';
import type { WebSocket } from 'ws';
import type { PeerChangeEvent, PeerChangeListener, PeerSummary } from './contract';
import { SCOPE } from './shared';

export interface PeerRegistry {
  /** Connections past handshake. Only these receive broadcasts. */
  readonly ready: Set<WebSocket>;
  /**
   * PeerConnection per socket — every accepted connection has one.
   * Created on successful HELLO; disposed on socket close.
   */
  readonly peerBySocket: Map<WebSocket, PeerConnection>;
  /**
   * PeerSummary mirror — used by listConnectedPeers + emitted on
   * subscribePeerChange. Mirrors `peerBySocket` 1:1 so the snapshot
   * read path doesn't touch `PeerConnection` internals.
   */
  readonly summaryBySocket: Map<WebSocket, PeerSummary>;
  readonly peerChangeListeners: Set<PeerChangeListener>;
  /**
   * Liveness flag per socket — set true on any inbound frame (protocol
   * pong or application message), flipped false by each heartbeat sweep
   * before it re-pings. A socket still false at the next sweep is
   * unresponsive and gets terminated. A WeakMap so a closed socket's
   * entry is reclaimed without manual cleanup.
   */
  readonly alive: WeakMap<WebSocket, boolean>;
  emitPeerChange(event: PeerChangeEvent): void;
}

export function createPeerRegistry(): PeerRegistry {
  const peerChangeListeners = new Set<PeerChangeListener>();
  return {
    ready: new Set<WebSocket>(),
    peerBySocket: new Map<WebSocket, PeerConnection>(),
    summaryBySocket: new Map<WebSocket, PeerSummary>(),
    peerChangeListeners,
    alive: new WeakMap<WebSocket, boolean>(),
    emitPeerChange(event: PeerChangeEvent): void {
      for (const listener of peerChangeListeners) {
        try {
          listener(event);
        } catch (err) {
          // A misbehaving listener must not prevent other listeners (or
          // the server's own bookkeeping) from completing.
          logger.warn(SCOPE, 'peer-change listener threw', err);
        }
      }
    },
  };
}
