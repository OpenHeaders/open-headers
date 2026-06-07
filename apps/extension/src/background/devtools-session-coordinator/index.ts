/**
 * DevTools session coordinator — resets per-session state when DevTools is
 * genuinely reopened on a tab.
 *
 * Our capture is service-worker-resident and continuous (always-on
 * `webRequest` + HAR while DevTools is open), decoupled from any single
 * DevTools session. Chrome, by contrast, ties its Network log to a DevTools
 * session: opening DevTools starts a fresh log, closing it discards the log.
 * To match that, the devtools_page mints one session token per DevTools-open
 * and posts it as the first `session` frame on the
 * `devtools-har-source:<tabId>` port (and re-posts it on every reconnect, so
 * a cold SW relearns it). This coordinator is the fourth cohabiting consumer
 * of that port — siblings read `har`/`har-body`, `nav`/`nav-timing`, and
 * `resource-timing`; this one reads only `session`.
 *
 * On a changed token (a real reopen) the lifecycle hub advances its
 * watch-session floor to the DevTools-open moment, so the reopened log drops
 * everything captured before. When that happens we also drop the tab's
 * cached Resource Timing groups so the reopened session doesn't replay the
 * prior session's memory-cache rows, and reset the tab's page stream so page
 * ids restart at `page_1` — mirroring the host, whose `PageLoad` id counter is
 * a frontend-module static that resets every time DevTools is (re)opened. The
 * same token (an SW-eviction reconnect) is a no-op — the live log is preserved.
 */

import { type HarSourceMessage, parseHarSourcePortName } from '@openheaders/core/types';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import type { ResourceTimingRelay } from '../resource-timing-relay';

export interface DevtoolsSessionCoordinator {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface DevtoolsSessionCoordinatorOptions {
  readonly hub: RequestLifecycleHub;
  readonly relay: ResourceTimingRelay;
  readonly pageHub: PageStreamHub;
}

export function startDevtoolsSessionCoordinator(
  options: DevtoolsSessionCoordinatorOptions,
): DevtoolsSessionCoordinator {
  const { hub, relay, pageHub } = options;
  const onConnect = getBrowserAPI().runtime?.onConnect;
  if (!onConnect?.addListener) {
    logger.info('DevtoolsSessionCoordinator', 'runtime.onConnect unavailable — session reset disabled');
    return { dispose: () => {} };
  }

  const listener = (port: chrome.runtime.Port): void => {
    const tabId = parseHarSourcePortName(port.name);
    if (tabId === null) return;
    port.onMessage.addListener((msg: HarSourceMessage) => {
      if (msg?.type !== 'session' || typeof msg.token !== 'string' || typeof msg.openedAtWallMs !== 'number') {
        return;
      }
      // A new token means a genuine reopen → the hub advanced the floor;
      // mirror that by dropping the tab's cached Resource Timing groups and
      // resetting its page stream so page ids restart at `page_1` (host
      // parity). The same token (an SW-eviction reconnect) is a no-op.
      if (hub.startSession(tabId, msg.token, msg.openedAtWallMs)) {
        relay.forgetTab(tabId);
        pageHub.forgetTab(tabId);
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
