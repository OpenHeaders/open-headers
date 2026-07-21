/**
 * Scoped browser-routing controller (OBSERVABILITY_PLAN.md §5.1) — the
 * daemon side of the routing control plane. Owns no routing truth of
 * its own: the capture service holds the persisted desire and folds it
 * with the proxy's run state ({@link ProxyRoutingWireState}); this
 * module pushes that folded verdict to every same-device browser peer
 * and remembers each peer's ack for the status projection.
 *
 * Push triggers: a peer's connect, its `oh.proxy.routing.hello` (the
 * cold-service-worker pull), and every routing-change signal from the
 * capture service (start/stop, scope edit, desire flip). Frames go to
 * loopback peers ONLY — the capture port is loopback-bound, so telling
 * an off-device browser to route there can never be right — and inbound
 * hello/ack frames from off-device wires are claimed and dropped, the
 * telemetry plane's exact posture.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { PROXY_ROUTING_ACK_TYPE, PROXY_ROUTING_HELLO_TYPE, PROXY_ROUTING_STATE_TYPE } from '@openheaders/core/protocol';
import type { ProxyRoutingMode, ProxyRoutingPeerState, ProxyRoutingStatus } from '@openheaders/core/types';
import type { OracleWsServer, PeerSummary, WsPeerPushHooks } from '../../host-runtime/ws-server';
import type { ProxyCaptureService } from './proxy-capture-service';

const SCOPE = 'proxy-routing';

function parseRoutingMode(mode: unknown): ProxyRoutingMode | null {
  return mode === 'pac' || mode === 'onRequest' || mode === 'unsupported' ? mode : null;
}

/** The capture-service surface this controller consumes. */
export type ProxyRoutingCaptureSource = Pick<
  ProxyCaptureService,
  'getRoutingEnabled' | 'setRoutingEnabled' | 'getRoutingWireState' | 'subscribeRoutingChange'
>;

export type ProxyRoutingSetResult = { ok: true; routing: ProxyRoutingStatus } | { ok: false; error: string };

export interface ProxyRoutingControl {
  /** Inbound push seam for the WS server (hello + ack frames). */
  readonly peerPush: WsPeerPushHooks;
  /** Late-bound live server slot — the bind supervisor's swaps flow through. */
  setWsServer(server: OracleWsServer | null): void;
  /** The `oh.daemon.proxy.routing.set` backing. */
  setEnabled(enabled: boolean): Promise<ProxyRoutingSetResult>;
  /** The `oh.daemon.proxy.routing.status` backing. */
  status(): Promise<ProxyRoutingStatus>;
  dispose(): void;
}

/**
 * The stable partition qualifier for a peer — its HELLO `installId`
 * when it sends one, else its `nodeId` (the browser-live-relay's exact
 * law: `nodeId` is the active workspace's writer identity and changes
 * on join → adopt, so keying acks on it would orphan them on a flap).
 */
function peerKey(peer: PeerSummary): string {
  return peer.installId ?? peer.nodeId;
}

export function createProxyRoutingControl(capture: ProxyRoutingCaptureSource): ProxyRoutingControl {
  let server: OracleWsServer | null = null;
  let unsubscribePeerChange: (() => void) | null = null;
  let disposed = false;
  const acks = new Map<string, ProxyRoutingPeerState>();

  async function pushState(filterPeer: (peer: PeerSummary) => boolean): Promise<void> {
    const liveServer = server;
    if (liveServer === null || disposed) return;
    const state = await capture.getRoutingWireState();
    if (server !== liveServer || disposed) return;
    liveServer.broadcastFrame(
      {
        type: PROXY_ROUTING_STATE_TYPE,
        enabled: state.enabled,
        port: state.port,
        scopePatterns: state.scopePatterns,
      },
      { filterPeer: (peer) => peer.isLoopback && filterPeer(peer) },
    );
  }

  const pushAll = (): void => {
    void pushState(() => true).catch((err: unknown) => {
      logger.warn(SCOPE, 'routing state push failed', err);
    });
  };

  const pushToPeer = (target: PeerSummary): void => {
    void pushState((peer) => peer.peerId === target.peerId).catch((err: unknown) => {
      logger.warn(SCOPE, 'routing state push to peer failed', err);
    });
  };

  const unsubscribeRoutingChange = capture.subscribeRoutingChange(pushAll);

  function handleAck(message: Record<string, unknown>, peer: PeerSummary): void {
    const { applied, error } = message;
    const mode = parseRoutingMode(message.mode);
    if (typeof applied !== 'boolean' || mode === null) return;
    acks.set(peerKey(peer), {
      nodeId: peerKey(peer),
      agent: peer.agent,
      applied,
      mode,
      ...(typeof error === 'string' && error.length > 0 ? { error } : {}),
    });
  }

  async function status(): Promise<ProxyRoutingStatus> {
    const [enabled, wireState] = await Promise.all([capture.getRoutingEnabled(), capture.getRoutingWireState()]);
    return { enabled, active: wireState.enabled, peers: [...acks.values()] };
  }

  const peerPush: WsPeerPushHooks = {
    owns(type) {
      return type === PROXY_ROUTING_HELLO_TYPE || type === PROXY_ROUTING_ACK_TYPE;
    },
    handle(message, peer) {
      // Same-device wires only — claimed and dropped otherwise.
      if (!peer.isLoopback) return;
      if (message.type === PROXY_ROUTING_HELLO_TYPE) pushToPeer(peer);
      else handleAck(message, peer);
    },
  };

  return {
    peerPush,
    setWsServer(next) {
      unsubscribePeerChange?.();
      unsubscribePeerChange = null;
      server = next;
      acks.clear();
      if (next) {
        unsubscribePeerChange = next.subscribePeerChange((event) => {
          if (event.kind === 'connect') pushToPeer(event.peer);
          else acks.delete(peerKey(event.peer));
        });
        // Peers already past handshake on an attached server (controller
        // installed after first bind) get the current state too.
        for (const peer of next.listConnectedPeers()) pushToPeer(peer);
      }
    },
    async setEnabled(enabled) {
      if (typeof enabled !== 'boolean') return { ok: false, error: 'enabled must be a boolean' };
      // Persisting fires the capture service's routing-change signal,
      // which is what pushes the folded verdict to every peer.
      await capture.setRoutingEnabled(enabled);
      return { ok: true, routing: await status() };
    },
    status,
    dispose() {
      disposed = true;
      unsubscribeRoutingChange();
      unsubscribePeerChange?.();
      unsubscribePeerChange = null;
      server = null;
      acks.clear();
    },
  };
}
