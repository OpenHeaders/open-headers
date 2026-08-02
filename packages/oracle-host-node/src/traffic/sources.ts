/**
 * The two tappable traffic sources (AGENT_TRAFFIC_PLAN.md §8 S1), each
 * normalized to ONE feed shape — a `LifecycleWireMessage` stream into a
 * `TrafficRetentionConsumer` — so the reducer neither knows nor cares
 * which transport fed it:
 *
 *   - **browser-tab** — a loopback lifeline dialed against the browser
 *     live-relay's qualified acceptor (`oh-lifecycle:<tabId>@<nodeId>`).
 *     The tap is one more viewer of the partition: own consumer id, own
 *     extension-side stream session, and the relay's `rejoinPeerWatches`
 *     re-subscribes it across peer reconnects like any other viewer.
 *   - **proxy** — a hub sink attached directly to the daemon-side
 *     proxy-capture hub (the partition's engine lives in this process;
 *     there is no wire to ride). Deliveries are wrapped into the same
 *     wire envelopes the port would carry, mirroring the projection in
 *     `daemon/proxy/capture-lifeline.ts`.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import { type LifecycleWireMessage, qualifiedLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type { RequestLifecycleHub, Sink } from '@openheaders/oracle/request-lifecycle-hub';
import type { TrafficRetentionConsumer } from '@openheaders/oracle/traffic-retention';

import type { LoopbackLifelineDialer } from './loopback-lifeline';

/** One live source connection; `close()` releases the subscription. */
export interface TrafficSourceConnection {
  close(): void;
}

/**
 * Subscribe one browser tab through the relay. Returns `null` when no
 * acceptor claimed the qualified port (relay not installed) — the
 * caller surfaces that as an arm failure, not a throw.
 */
export function connectBrowserTabSource(deps: {
  dialer: LoopbackLifelineDialer;
  nodeId: string;
  tabId: number;
  consumer: TrafficRetentionConsumer;
}): TrafficSourceConnection | null {
  const port = deps.dialer.dial(qualifiedLifecyclePortName(deps.tabId, deps.nodeId));
  if (port === null) return null;
  port.onMessage<LifecycleWireMessage>((message) => {
    deps.consumer.handle(message);
  });
  // Arming subscribes (PLAN §1.1) — the relay forwards this to the
  // owning peer and re-sends it on every peer reconnect.
  port.send({ kind: 'subscribe' });
  return {
    close() {
      // The relay turns the port disconnect into the peer-side detach;
      // the extension refcounts sessions and stops streaming on the
      // last one (the no-viewer → silence law).
      port.disconnect();
    },
  };
}

/**
 * Attach the retention consumer to the in-process proxy-capture hub.
 * The sink projects hub deliveries into the same envelopes the port
 * transport carries, so the consumer's replay/dedup path is identical
 * across sources.
 */
export function connectProxySource(deps: {
  hub: RequestLifecycleHub;
  consumer: TrafficRetentionConsumer;
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
    close() {
      handle.detach();
    },
  };
}
