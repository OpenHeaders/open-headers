/**
 * The two tappable traffic sources (AGENT_TRAFFIC_PLAN.md §8 S1), each
 * normalized to ONE feed shape — a verbatim `LifecycleWireMessage`
 * stream — so the tap neither knows nor cares which transport fed it:
 *
 *   - **browser-tab** — a tap seat on the partition mirror (§11.2, C2):
 *     the mirror owns the ONE wire session per watched partition and
 *     fans the verbatim envelope stream to this connection, so the
 *     replay/dedup/arm-floor contract is exactly what a dedicated relay
 *     port carried before convergence.
 *   - **proxy** — a hub sink attached directly to the daemon-side
 *     proxy-capture hub (the partition's engine lives in this process;
 *     there is no wire to ride). Deliveries are wrapped into the same
 *     wire envelopes the port would carry, mirroring the projection in
 *     `daemon/proxy/capture-lifeline.ts`.
 *
 * The C3 recorder made the envelope the ONE seam: connections deliver
 * every envelope verbatim — `body-attached` included — and the tap
 * owns the body/consumer routing split (it also tees the stream to an
 * active recording session, which needs the reducer INPUT whole).
 * `requestBody` forwards the lifecycle port's one pull message on the
 * same transports.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import type { RequestLifecycleHub, Sink } from '@openheaders/oracle/request-lifecycle-hub';

import type { TrafficPartitionMirror } from './partition-mirror';

/** One live source connection; `close()` releases the subscription. */
export interface TrafficSourceConnection {
  /** Ask the engine for one hop's response body — answered (maybe) by a
   *  `body-attached` envelope on the same stream, or by silence. */
  requestBody(requestId: string, hopIndex: number): void;
  close(): void;
}

/**
 * Join one browser tab's partition through the mirror. Returns `null`
 * when the mirror's wire dial found no acceptor (relay not installed) —
 * the caller surfaces that as an arm failure, not a throw.
 */
export function connectBrowserTabSource(deps: {
  mirror: TrafficPartitionMirror;
  nodeId: string;
  tabId: number;
  onEnvelope: (message: LifecycleWireMessage) => void;
}): TrafficSourceConnection | null {
  const seat = deps.mirror.attachTapConsumer(deps.nodeId, deps.tabId, deps.onEnvelope);
  if (seat === null) return null;
  return {
    requestBody(requestId, hopIndex) {
      seat.requestBody(requestId, hopIndex);
    },
    close() {
      // The last reader out releases the mirror's wire session — the
      // relay turns that disconnect into the peer-side detach and the
      // extension stops streaming (the no-viewer → silence law).
      seat.detach();
    },
  };
}

/**
 * Attach to the in-process proxy-capture hub. The sink projects hub
 * deliveries into the same envelopes the port transport carries, so
 * the tap's replay/dedup path is identical across sources. Body pulls
 * dispatch to the capture service's `serveRequestBody`, whose answer
 * arrives as an ordinary hub `body-attached` delivery — the same
 * envelope shape as the wire.
 */
export function connectProxySource(deps: {
  hub: RequestLifecycleHub;
  onEnvelope: (message: LifecycleWireMessage) => void;
  /** `proxyCaptureService.serveRequestBody` — absent on hosts without
   *  the capture proxy; pulls then answer with silence. */
  serveBody?: (requestId: string, hopIndex: number) => void;
}): TrafficSourceConnection {
  const sink: Sink = {
    deliverReady(tabId, watermarkMs, sessionToken) {
      deps.onEnvelope({
        kind: 'ready',
        tabId,
        watermarkMs,
        ...(sessionToken !== undefined ? { sessionToken } : {}),
      });
    },
    deliverUpdate(update) {
      deps.onEnvelope({ kind: 'lifecycle-update', update });
    },
    deliverTabCleared(tabId) {
      deps.onEnvelope({ kind: 'tab-cleared', tabId });
    },
    close() {
      // Hub-initiated detach (dispose); nothing to release beyond the
      // handle the registry already dropped.
    },
  };
  const handle = deps.hub.attach(PROXY_LIFECYCLE_TAB_ID, sink);
  return {
    requestBody(requestId, hopIndex) {
      deps.serveBody?.(requestId, hopIndex);
    },
    close() {
      handle.detach();
    },
  };
}
