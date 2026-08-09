/**
 * Capture-feedback pusher (AGENT_TRAFFIC_PLAN.md §4) — the daemon side
 * of the in-browser capture badge. Owns no capture truth of its own:
 * the tap's armed-source registry decides which tabs agents can read;
 * this module pushes each browser peer the COMPLETE set of its
 * capture-armed tabIds so the extension's tab-group reactor badges
 * exactly those tabs — a workbench live view never reaches this plane.
 *
 * Push triggers: a peer's connect, its `oh.traffic.capture.hello` (the
 * cold-service-worker pull), every tap status transition (arm, disarm,
 * idle expiry), and server attach. Full-set pushes are idempotent, so a
 * peer with nothing armed gets `tabIds: []` — the frame that clears its
 * last badge. Frames go to loopback peers ONLY, and inbound hello
 * frames from off-device wires are claimed and dropped — the telemetry
 * plane's exact posture.
 *
 * Streaming arms only: a consent-refused watch feeds agents nothing and
 * never badges. The tap keys browser-tab sources by the stable peer
 * qualifier (`installId` ?? `nodeId` — the arm RPC resolves it from the
 * inventory), so per-peer routing matches the browser-live-relay's law.
 */

import { TRAFFIC_CAPTURE_HELLO_TYPE, TRAFFIC_CAPTURE_STATE_TYPE } from '@openheaders/core/protocol';
import type { OracleWsServer, PeerSummary, WsPeerPushHooks } from '../../host-runtime/ws-server';
import type { TrafficTap } from '../../traffic/tap';

/** The tap surface this pusher consumes. */
export type CaptureFeedbackTapSource = Pick<TrafficTap, 'status' | 'onStatusChanged'>;

export interface CaptureFeedbackPush {
  /** Inbound push seam for the WS server (hello frames). */
  readonly peerPush: WsPeerPushHooks;
  /** Late-bound live server slot — the bind supervisor's swaps flow through. */
  setWsServer(server: OracleWsServer | null): void;
  dispose(): void;
}

/** The stable partition qualifier — the browser-live-relay's exact law. */
function peerKey(peer: PeerSummary): string {
  return peer.installId ?? peer.nodeId;
}

export function createCaptureFeedbackPush(tap: CaptureFeedbackTapSource): CaptureFeedbackPush {
  let server: OracleWsServer | null = null;
  let unsubscribePeerChange: (() => void) | null = null;
  let disposed = false;

  /** Capture-armed tabIds per stable peer qualifier, streaming arms only. */
  function capturedByPeer(): Map<string, number[]> {
    const byPeer = new Map<string, number[]>();
    for (const source of tap.status()) {
      if (source.nodeId === undefined || source.tabId === undefined || source.state !== 'streaming') continue;
      const tabIds = byPeer.get(source.nodeId);
      if (tabIds) tabIds.push(source.tabId);
      else byPeer.set(source.nodeId, [source.tabId]);
    }
    return byPeer;
  }

  function pushState(filterPeer: (peer: PeerSummary) => boolean): void {
    const liveServer = server;
    if (liveServer === null || disposed) return;
    const byPeer = capturedByPeer();
    for (const peer of liveServer.listConnectedPeers()) {
      if (!peer.isLoopback || !filterPeer(peer)) continue;
      const key = peerKey(peer);
      liveServer.broadcastFrame(
        { type: TRAFFIC_CAPTURE_STATE_TYPE, tabIds: byPeer.get(key) ?? [] },
        { filterPeer: (p) => p.peerId === peer.peerId },
      );
    }
  }

  const pushAll = (): void => pushState(() => true);
  const pushToPeer = (target: PeerSummary): void => pushState((peer) => peer.peerId === target.peerId);

  const unsubscribeStatus = tap.onStatusChanged(pushAll);

  const peerPush: WsPeerPushHooks = {
    owns(type) {
      return type === TRAFFIC_CAPTURE_HELLO_TYPE;
    },
    handle(message, peer) {
      // Same-device wires only — claimed and dropped otherwise.
      if (!peer.isLoopback) return;
      if (message.type === TRAFFIC_CAPTURE_HELLO_TYPE) pushToPeer(peer);
    },
  };

  return {
    peerPush,
    setWsServer(next) {
      unsubscribePeerChange?.();
      unsubscribePeerChange = null;
      server = next;
      if (next) {
        unsubscribePeerChange = next.subscribePeerChange((event) => {
          if (event.kind === 'connect') pushToPeer(event.peer);
        });
        // Peers already past handshake on an attached server (pusher
        // installed after first bind) get the current set too.
        for (const peer of next.listConnectedPeers()) pushToPeer(peer);
      }
    },
    dispose() {
      disposed = true;
      unsubscribeStatus();
      unsubscribePeerChange?.();
      unsubscribePeerChange = null;
      server = null;
    },
  };
}
