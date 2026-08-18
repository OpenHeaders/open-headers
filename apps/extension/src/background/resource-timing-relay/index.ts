/**
 * Chrome wiring for `ResourceTimingRelay`.
 *
 * One `runtime.onConnect` listener serves both halves of the feed:
 *   - outbound `oh-rt:<tabId>` — a panel subscriber; we attach a sink
 *     that forwards `ResourceTimingWireMessage`s over the port and
 *     detach on disconnect.
 *   - inbound `devtools-har-source:<tabId>` — the devtools-page port,
 *     from which we read `resource-timing` snapshots. This port name is
 *     shared with the HAR adapter and the nav bridge; chrome dispatches
 *     the same `Port` to every listener, and each consumes a disjoint
 *     subset of `HarSourceMessage` (we take only `resource-timing`).
 */

import { parseResourceTimingPortName } from '@openheaders/core/resource-timing';
import { type HarSourceMessage, parseHarSourcePortName } from '@openheaders/core/types';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { isExtensionOriginPort } from '../port-origin-gate';
import type { ResourceTimingRelay } from './relay';
import { createResourceTimingRelay } from './relay';

export type { ResourceTimingRelay, ResourceTimingRelayOptions } from './relay';
export { createResourceTimingRelay } from './relay';

export interface ResourceTimingRelayHost {
  /**
   * The underlying relay — exposed so a sibling adapter (the DevTools
   * session coordinator) can drop a tab's cached groups when a genuine
   * DevTools reopen starts a fresh session.
   */
  readonly relay: ResourceTimingRelay;
  /** Detach the onConnect listener + dispose the relay. Tests / SW shutdown. */
  dispose(): void;
}

export interface ResourceTimingRelayHostOptions {
  readonly bus?: TabLifecycleBus;
}

export function startResourceTimingRelay(options: ResourceTimingRelayHostOptions = {}): ResourceTimingRelayHost {
  const relay = createResourceTimingRelay({ bus: options.bus });
  const onConnect = getBrowserAPI().runtime?.onConnect;
  if (!onConnect?.addListener) {
    logger.info('ResourceTimingRelay', 'runtime.onConnect unavailable — resource-timing feed disabled');
    return { relay, dispose: () => relay.dispose() };
  }

  const listener = (port: chrome.runtime.Port): void => {
    const subscriberTabId = parseResourceTimingPortName(port.name);
    if (subscriberTabId !== null) {
      if (!isExtensionOriginPort(port, 'ResourceTimingRelay')) return;
      const detach = relay.subscribe(subscriberTabId, (msg) => {
        try {
          port.postMessage(msg);
        } catch {
          /* port disconnected — onDisconnect will detach */
        }
      });
      port.onDisconnect.addListener(() => detach());
      return;
    }

    const sourceTabId = parseHarSourcePortName(port.name);
    if (sourceTabId === null) return;
    if (!isExtensionOriginPort(port, 'ResourceTimingRelay')) return;
    port.onMessage.addListener((msg: HarSourceMessage) => {
      if (msg?.type === 'resource-timing' && typeof msg.timeOriginMs === 'number' && Array.isArray(msg.entries)) {
        relay.notifySnapshot(sourceTabId, msg.timeOriginMs, msg.entries);
      }
    });
  };

  onConnect.addListener(listener);
  return {
    relay,
    dispose: () => {
      try {
        onConnect.removeListener(listener);
      } catch {
        /* already gone — SW shutdown */
      }
      relay.dispose();
    },
  };
}
