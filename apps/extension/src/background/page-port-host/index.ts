/**
 * Page port host — chrome adapter for `PageStreamHub`.
 *
 * Wires `chrome.runtime.onConnect` so panel / popup / future surfaces
 * can open `oh-page:<tabId>` and receive `PageWireMessage` envelopes
 * (a `ready` then the tab's page replay + live updates).
 *
 * Sibling of `startLifecyclePortHost`. Page notifications into the hub
 * (`notifyNavStarted`, `notifyNavTimingAttached`) are driven from the
 * existing devtools_page → background nav events; see
 * `wire-page-hub-from-har-source` in the background entry.
 */

import { logger } from '@utils/logger';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { acceptPagePort } from './accept-port';

export {
  PAGE_PORT_PREFIX,
  pagePortName,
  parsePagePortName,
} from '@openheaders/oracle/page-stream-hub';

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
