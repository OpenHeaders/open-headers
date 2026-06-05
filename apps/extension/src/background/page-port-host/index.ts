/**
 * Page port host — chrome adapter for `PageStreamHub`.
 *
 * Wires `chrome.runtime.onConnect` so panel / popup / future surfaces
 * can open `oh-page:<tabId>` and receive `PageWireMessage` envelopes
 * (a `ready` then the tab's page replay + live updates).
 *
 * Sibling of `startLifecyclePortHost`. Page notifications into the hub
 * (`notifyNavStarted`, `notifyNavTimingAttached`) are driven by
 * `startDevtoolsPageNavBridge` — the inbound half exported from this
 * module.
 */

import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { logger } from '@utils/logger';
import { acceptPagePort } from './accept-port';

export type { CdpPageBridge, CdpPageBridgeOptions } from './cdp-page-bridge';
export { startCdpPageBridge } from './cdp-page-bridge';
export type { DevtoolsPageNavBridge, DevtoolsPageNavBridgeOptions } from './devtools-page-nav-bridge';
export { startDevtoolsPageNavBridge } from './devtools-page-nav-bridge';

export interface PagePortHost {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface PagePortHostOptions {
  readonly hub: PageStreamHub;
}

export function startPagePortHost(options: PagePortHostOptions): PagePortHost {
  const { hub } = options;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('PagePortHost', 'runtime.onConnect unavailable — page ports disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    acceptPagePort(hub, port);
  };
  chrome.runtime.onConnect.addListener(listener);
  return {
    dispose: () => {
      try {
        chrome.runtime.onConnect.removeListener(listener);
      } catch {
        /* already gone — SW shutdown */
      }
    },
  };
}
