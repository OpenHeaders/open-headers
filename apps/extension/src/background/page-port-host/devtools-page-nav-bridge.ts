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
 *
 * Mode-gating: this Performance-API path is the page source for
 * heuristic-owned tabs only. A CDP-owned tab takes its pages from the
 * `Page`-domain feed (`startCdpPageBridge`), whose timings match Chrome's
 * exporter; feeding both would double the tab's pages. `isCdpOwned` is the
 * same per-tab ownership the request correlators route on.
 *
 * Page binding: each `nav` mints its page synchronously (ordering is the
 * page list's invariant — `getFrame` callbacks may resolve out of order on
 * rapid navigations, so minting never waits on one), then the committed
 * main frame's `documentId` is resolved asynchronously
 * (`webNavigation.getFrame`) and attached via
 * `notifyPageDocumentAttached`. Two staleness guards before attaching: the
 * page must still be the tab's latest, and the resolved frame URL must
 * match the nav URL — a newer commit racing the resolution fails one of
 * them and the page simply keeps no documentId (its rows fall to the
 * supersession time floor, today's behavior). Chromium-only: Firefox
 * frames carry no `documentId`, so the resolver finds none and baseline
 * engines keep the time floor.
 */

import { type HarSourceMessage, parseHarSourcePortName } from '@openheaders/core/types';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { isExtensionOriginPort } from '../port-origin-gate';

export interface DevtoolsPageNavBridge {
  /** Detach the chrome listener. Tests / SW shutdown only. */
  dispose(): void;
}

/** The committed main frame, as the platform reports it at resolution time. */
export interface MainFrameSnapshot {
  readonly url: string;
  /** Chromium 106+; absent on Firefox. */
  readonly documentId?: string;
}

export interface DevtoolsPageNavBridgeOptions {
  readonly hub: PageStreamHub;
  /** Injectable clock for deterministic tests; defaults to `Date.now`. */
  readonly now?: () => number;
  /**
   * Whether a tab's pages are sourced from the CDP `Page`-domain feed; when
   * it returns `true` this Performance-API bridge drops the tab's nav
   * messages so the two sources never both feed the same tab. Defaults to
   * "never CDP-owned" (heuristic-only hosts).
   */
  readonly isCdpOwned?: (tabId: number) => boolean;
  /**
   * Resolves the tab's current main frame — the committed document the
   * page binding reads. Injectable for tests; defaults to
   * `webNavigation.getFrame({tabId, frameId: 0})`.
   */
  readonly resolveMainFrame?: (tabId: number) => Promise<MainFrameSnapshot | null>;
}

/** `webNavigation.getFrame` on the tab's main frame, null on any failure. */
async function getMainFrame(tabId: number): Promise<MainFrameSnapshot | null> {
  const webNavigation = getBrowserAPI().webNavigation;
  if (!webNavigation?.getFrame) return null;
  try {
    const frame = await webNavigation.getFrame({ tabId, frameId: 0 });
    if (!frame) return null;
    return { url: frame.url, documentId: frame.documentId || undefined };
  } catch {
    return null;
  }
}

export function startDevtoolsPageNavBridge(options: DevtoolsPageNavBridgeOptions): DevtoolsPageNavBridge {
  const { hub, now = Date.now, isCdpOwned = () => false, resolveMainFrame = getMainFrame } = options;

  // Resolve the committed document's UUID and attach it to the page just
  // minted for this nav. Fire-and-forget from the message handler; the
  // guards drop a resolution that a newer commit raced past.
  const attachCommittedDocument = (tabId: number, pageId: string, navUrl: string): void => {
    void resolveMainFrame(tabId).then((frame) => {
      if (!frame?.documentId) return;
      if (frame.url !== navUrl) return;
      const pages = hub.snapshotTab(tabId);
      if (pages.length === 0 || pages[pages.length - 1].id !== pageId) return;
      hub.notifyPageDocumentAttached(tabId, pageId, frame.documentId);
    });
  };
  const onConnect = getBrowserAPI().runtime?.onConnect;
  if (!onConnect?.addListener) {
    logger.info('DevtoolsPageNavBridge', 'runtime.onConnect unavailable — nav bridge disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    const tabId = parseHarSourcePortName(port.name);
    if (tabId === null) return;
    if (!isExtensionOriginPort(port, 'DevtoolsPageNavBridge')) return;
    port.onMessage.addListener((msg: HarSourceMessage) => {
      if (!msg) return;
      // A CDP-owned tab is fed by the Page-domain bridge; ignore its
      // Performance-API nav messages to avoid duplicate pages.
      if (isCdpOwned(tabId)) return;
      if (msg.type === 'nav' && typeof msg.url === 'string') {
        // A failed navigation lands on the browser's internal `chrome-error://`
        // page; the host creates no `PageLoad` for it, so skip it here too —
        // the page id counter must not advance for an error commit.
        if (msg.url.startsWith('chrome-error://')) return;
        const page = hub.notifyNavStarted(tabId, now(), msg.url);
        attachCommittedDocument(tabId, page.id, msg.url);
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
