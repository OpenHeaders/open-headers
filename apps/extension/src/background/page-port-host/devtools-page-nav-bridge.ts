/**
 * Devtools-page → PageStreamHub nav bridge.
 *
 * Inbound half of the `oh-page:<tabId>` surface, sibling of
 * `startPagePortHost` (the outbound half). Listens on
 * `chrome.runtime.onConnect` for ports named `devtools-har-source:<tabId>`
 * — opened by the `devtools_page` extension page for the lifetime of the
 * DevTools window — and forwards `nav` / `nav-timing` messages into
 * `PageStreamHub` via its `notifyNavStarted` / `notifyNavTimingAttached`
 * verbs.
 *
 * Cohabitation: `ChromeHarEventSource` (correlator-host) listens on the
 * same port name for HAR messages. Chrome dispatches `runtime.onConnect`
 * to every listener with the same `Port` object; this bridge ignores
 * `har` / `har-body` and the HAR adapter ignores nav. Two single-purpose
 * adapters, one port — keeps each module's concerns narrow.
 */

import type { HarSourceMessage } from '@openheaders/core/types';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';

import { getBrowserAPI } from '@/types/browser';
import { logger } from '@utils/logger';

const HAR_SOURCE_PREFIX = 'devtools-har-source:';

function parseTabId(portName: string): number | null {
  if (!portName.startsWith(HAR_SOURCE_PREFIX)) return null;
  const parsed = Number.parseInt(portName.slice(HAR_SOURCE_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export interface DevtoolsPageNavBridge {
  /** Detach the chrome listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface DevtoolsPageNavBridgeOptions {
  readonly hub: PageStreamHub;
  /** Injectable clock for deterministic tests; defaults to `Date.now`. */
  readonly now?: () => number;
}

export function startDevtoolsPageNavBridge(options: DevtoolsPageNavBridgeOptions): DevtoolsPageNavBridge {
  const { hub, now = Date.now } = options;
  const onConnect = getBrowserAPI().runtime?.onConnect;
  if (!onConnect?.addListener) {
    logger.info('DevtoolsPageNavBridge', 'runtime.onConnect unavailable — nav bridge disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    const tabId = parseTabId(port.name);
    if (tabId === null) return;
    port.onMessage.addListener((msg: HarSourceMessage) => {
      if (!msg) return;
      if (msg.type === 'nav' && typeof msg.url === 'string') {
        hub.notifyNavStarted(tabId, now(), msg.url);
        return;
      }
      if (msg.type === 'nav-timing' && msg.timing && typeof msg.timing === 'object') {
        hub.notifyNavTimingAttached(tabId, msg.timing);
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
    },
  };
}
