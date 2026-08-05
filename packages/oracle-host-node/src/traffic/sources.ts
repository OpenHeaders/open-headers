/**
 * The two tappable traffic sources (AGENT_TRAFFIC_PLAN.md §8 S1), each
 * normalized to ONE feed shape — a `LifecycleWireMessage` stream into a
 * `TrafficRetentionConsumer` — so the reducer neither knows nor cares
 * which transport fed it:
 *
 *   - **browser-tab** — a tap seat on the partition mirror (§11.2, C2):
 *     the mirror owns the ONE wire session per watched partition and
 *     fans the verbatim envelope stream to this consumer, so the
 *     replay/dedup/arm-floor contract is exactly what a dedicated relay
 *     port carried before convergence.
 *   - **proxy** — a hub sink attached directly to the daemon-side
 *     proxy-capture hub (the partition's engine lives in this process;
 *     there is no wire to ride). Deliveries are wrapped into the same
 *     wire envelopes the port would carry, mirroring the projection in
 *     `daemon/proxy/capture-lifeline.ts`.
 *
 * S3 adds the body-pull plane on the SAME transports: `requestBody`
 * forwards the lifecycle port's one pull message (`request-body` — the
 * mirror sends it over the shared wire session), and the engine's
 * `body-attached` answer is intercepted here and routed to
 * `onBodyAttached` instead of the consumer — the reducer keeps ignoring
 * body frames wholesale; body handling is the tap's.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { InspectorHarBody } from '@openheaders/core/types';
import type { RequestLifecycleHub, Sink } from '@openheaders/oracle/request-lifecycle-hub';
import type { TrafficRetentionConsumer } from '@openheaders/oracle/traffic-retention';

import type { TrafficPartitionMirror } from './partition-mirror';

/** One live source connection; `close()` releases the subscription. */
export interface TrafficSourceConnection {
  /** Ask the engine for one hop's response body — answered (maybe) by a
   *  `body-attached` routed to `onBodyAttached`, or by silence. */
  requestBody(requestId: string, hopIndex: number): void;
  close(): void;
}

/** The `body-attached` answers a source connection intercepts. */
export type TrafficBodyAttachedHandler = (requestId: string, hopIndex: number, body: InspectorHarBody) => void;

/**
 * Join one browser tab's partition through the mirror. Returns `null`
 * when the mirror's wire dial found no acceptor (relay not installed) —
 * the caller surfaces that as an arm failure, not a throw.
 */
export function connectBrowserTabSource(deps: {
  mirror: TrafficPartitionMirror;
  nodeId: string;
  tabId: number;
  consumer: TrafficRetentionConsumer;
  onBodyAttached: TrafficBodyAttachedHandler;
}): TrafficSourceConnection | null {
  const seat = deps.mirror.attachTapConsumer(deps.nodeId, deps.tabId, (message) => {
    if (message.kind === 'lifecycle-update' && message.update.kind === 'body-attached') {
      deps.onBodyAttached(message.update.requestId, message.update.hopIndex, message.update.body);
      return;
    }
    deps.consumer.handle(message);
  });
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
 * Attach the retention consumer to the in-process proxy-capture hub.
 * The sink projects hub deliveries into the same envelopes the port
 * transport carries, so the consumer's replay/dedup path is identical
 * across sources. Body pulls dispatch to the capture service's
 * `serveRequestBody`, whose answer arrives as an ordinary hub
 * `body-attached` delivery — the same interception shape as the wire.
 */
export function connectProxySource(deps: {
  hub: RequestLifecycleHub;
  consumer: TrafficRetentionConsumer;
  onBodyAttached: TrafficBodyAttachedHandler;
  /** `proxyCaptureService.serveRequestBody` — absent on hosts without
   *  the capture proxy; pulls then answer with silence. */
  serveBody?: (requestId: string, hopIndex: number) => void;
}): TrafficSourceConnection {
  const sink: Sink = {
    deliverReady(tabId, watermarkMs, sessionToken) {
      deps.consumer.handle({
        kind: 'ready',
        tabId,
        watermarkMs,
        ...(sessionToken !== undefined ? { sessionToken } : {}),
      });
    },
    deliverUpdate(update) {
      if (update.kind === 'body-attached') {
        deps.onBodyAttached(update.requestId, update.hopIndex, update.body);
        return;
      }
      deps.consumer.handle({ kind: 'lifecycle-update', update });
    },
    deliverTabCleared(tabId) {
      deps.consumer.handle({ kind: 'tab-cleared', tabId });
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
