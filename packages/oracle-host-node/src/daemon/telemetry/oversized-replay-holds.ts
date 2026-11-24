/**
 * Oversized-replay holds — which watches the relay must stop asking a
 * peer to replay.
 *
 * A peer that predates the declared frame limit answers a `subscribe`
 * with the tab's whole retained history as ONE frame. Past the server's
 * inbound limit that frame closes the peer's connection, and the relay's
 * re-subscribe on the reconnect earns the same close: one tab's history
 * loops the whole wire, sync and every other watch with it. The relay
 * cannot change that sender, so it stops asking — the watch is HELD
 * until its history is gone (the viewer's `clear-session`, or the peer's
 * engine restarting), and everything else on the wire stays up.
 *
 * Attribution is exact, never timed. A watch is AWAITED from its
 * subscribe until its stream delivers a frame. A close for frame size
 * with one awaited watch names it. With several awaited — a reconnect
 * re-subscribes them together — the peer goes SERIAL: its watches are
 * subscribed one at a time, each after the previous one answered, so
 * the next close has exactly one awaited watch to name. Serial ends when
 * every queued watch has answered; a peer that never closes for size
 * never enters it.
 *
 * Pure bookkeeping: the relay sends the frames and tells this module
 * what happened.
 */

export type SubscribeAdmission =
  /** Send the subscribe now; the watch is awaited. */
  | 'send'
  /** The watch is held — refuse it to its viewers instead. */
  | 'held'
  /** The peer is serial and another watch is awaited — this one waits its turn. */
  | 'queued';

export interface OversizedReplayHolds {
  /** A subscribe for `(peer, tab)` is about to go out — may it? */
  admit(peerKey: string, tabId: number): SubscribeAdmission;
  /**
   * The watch's stream delivered a frame or a refusal. Returns the tab
   * whose queued subscribe goes out now (already counted as awaited), or
   * `null`.
   */
  answered(peerKey: string, tabId: number): number | null;
  /** The watch ended (its last viewer left). Same return as {@link answered}. */
  ended(peerKey: string, tabId: number): number | null;
  /**
   * The peer's connection closed. `forFrameSize` is the server's own
   * verdict on the close. Returns the tab newly held, or `null`.
   */
  peerClosed(peerKey: string, forFrameSize: boolean): number | null;
  /** The held history is gone for this watch. True when it was held. */
  release(peerKey: string, tabId: number): boolean;
  /** The peer's engine restarted — every history it held is gone. */
  releasePeer(peerKey: string): void;
  isHeld(peerKey: string, tabId: number): boolean;
}

interface PeerState {
  readonly awaited: Set<number>;
  readonly held: Set<number>;
  serial: boolean;
  queue: number[];
}

export function createOversizedReplayHolds(): OversizedReplayHolds {
  const peers = new Map<string, PeerState>();

  function stateOf(peerKey: string): PeerState {
    let state = peers.get(peerKey);
    if (!state) {
      state = { awaited: new Set(), held: new Set(), serial: false, queue: [] };
      peers.set(peerKey, state);
    }
    return state;
  }

  /** Hand the next queued watch its turn once nothing is awaited. */
  function advance(state: PeerState): number | null {
    if (!state.serial || state.awaited.size > 0) return null;
    const next = state.queue.shift();
    if (next === undefined) {
      state.serial = false;
      return null;
    }
    state.awaited.add(next);
    return next;
  }

  function settle(peerKey: string, tabId: number): number | null {
    const state = peers.get(peerKey);
    if (!state) return null;
    const wasAwaited = state.awaited.delete(tabId);
    const queuedAt = state.queue.indexOf(tabId);
    if (queuedAt >= 0) state.queue.splice(queuedAt, 1);
    return wasAwaited || queuedAt >= 0 ? advance(state) : null;
  }

  return {
    admit(peerKey, tabId) {
      const state = stateOf(peerKey);
      if (state.held.has(tabId)) return 'held';
      if (state.awaited.has(tabId)) return 'send';
      if (state.serial && state.awaited.size > 0) {
        if (!state.queue.includes(tabId)) state.queue.push(tabId);
        return 'queued';
      }
      state.awaited.add(tabId);
      return 'send';
    },
    answered: settle,
    ended: settle,
    peerClosed(peerKey, forFrameSize) {
      const state = peers.get(peerKey);
      if (!state) return null;
      let newlyHeld: number | null = null;
      if (forFrameSize) {
        if (state.awaited.size === 1) {
          const [tabId] = state.awaited;
          state.held.add(tabId);
          newlyHeld = tabId;
        } else if (state.awaited.size > 1) {
          state.serial = true;
        }
      }
      // Every subscribe died with the socket; the reconnect asks again.
      state.awaited.clear();
      state.queue = [];
      return newlyHeld;
    },
    release(peerKey, tabId) {
      return peers.get(peerKey)?.held.delete(tabId) ?? false;
    },
    releasePeer(peerKey) {
      peers.delete(peerKey);
    },
    isHeld(peerKey, tabId) {
      return peers.get(peerKey)?.held.has(tabId) ?? false;
    },
  };
}
