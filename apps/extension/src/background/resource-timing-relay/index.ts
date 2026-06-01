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
import type { HarSourceMessage } from '@openheaders/core/types';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { createResourceTimingRelay } from './relay';

export type { ResourceTimingRelay, ResourceTimingRelayOptions } from './relay';
export { createResourceTimingRelay } from './relay';

const HAR_SOURCE_PREFIX = 'devtools-har-source:';

function parseHarSourceTabId(portName: string): number | null {
  if (!portName.startsWith(HAR_SOURCE_PREFIX)) return null;
  const parsed = Number.parseInt(portName.slice(HAR_SOURCE_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export interface ResourceTimingRelayHost {
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
    return { dispose: () => relay.dispose() };
  }

  const listener = (port: chrome.runtime.Port): void => {
    const subscriberTabId = parseResourceTimingPortName(port.name);
    if (subscriberTabId !== null) {
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

    const sourceTabId = parseHarSourceTabId(port.name);
    if (sourceTabId === null) return;
    port.onMessage.addListener((msg: HarSourceMessage) => {
      if (msg?.type === 'resource-timing' && typeof msg.timeOriginMs === 'number' && Array.isArray(msg.entries)) {
        relay.notifySnapshot(sourceTabId, msg.timeOriginMs, msg.entries);
      }
    });
  };

  onConnect.addListener(listener);
  return {
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
