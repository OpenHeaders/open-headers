/**
 * Chrome adapter implementing the host-side HAR seam ({@link HarEventSource}
 * + {@link HarPresenceSource}). H2/H3.
 *
 * Sole responsibility: own `chrome.runtime.onConnect` for ports named
 * `devtools-har-source:<tabId>`, normalize each incoming
 * {@link HarSourceMessage} into the oracle-shaped {@link HarEvent}, and
 * emit `tab-har-active` / `tab-har-inactive` presence events on port
 * open / close.
 *
 * Cohabitation: legacy `apps/extension/src/background/modules/devtools-
 * inspector-port.ts` also registers a `chrome.runtime.onConnect` listener
 * for the same port name. Chrome dispatches both listeners on every
 * connect with the same `Port` object; the two paths process their own
 * message handlers independently. This is the same parallel-path
 * discipline H1 used for `chrome.webRequest.*` until rows RM3–RM6 retire
 * the legacy duplicate; a future RM-style row will retire the legacy
 * HAR ingestion here.
 *
 * Cross-browser: uses `getBrowserAPI()` for Firefox/Chrome/Safari/Edge.
 */

import type {
  HarEvent,
  HarEventSource,
  HarPresenceEvent,
  HarPresenceSource,
} from '@openheaders/oracle/correlator-heuristic';
import type { HarSourceMessage } from '@openheaders/core/types';

import { getBrowserAPI } from '@/types/browser';
import { logger } from '@utils/logger';

const HAR_SOURCE_PREFIX = 'devtools-har-source:';

function parseTabId(portName: string): number | null {
  if (!portName.startsWith(HAR_SOURCE_PREFIX)) return null;
  const parsed = Number.parseInt(portName.slice(HAR_SOURCE_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

type HarListener = (event: HarEvent) => void;
type PresenceListener = (event: HarPresenceEvent) => void;

export class ChromeHarEventSource implements HarEventSource, HarPresenceSource {
  private readonly harListeners = new Set<HarListener>();
  private readonly presenceListeners = new Set<PresenceListener>();
  private readonly removeOnConnect: (() => void) | null;
  private installed = false;

  constructor() {
    this.removeOnConnect = this.installOnConnect();
  }

  subscribe(listener: HarListener): () => void {
    this.harListeners.add(listener);
    return () => {
      this.harListeners.delete(listener);
    };
  }

  subscribePresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  /** Tear down the chrome listener. Tests / SW shutdown only. */
  dispose(): void {
    if (this.removeOnConnect) this.removeOnConnect();
    this.harListeners.clear();
    this.presenceListeners.clear();
    this.installed = false;
  }

  private installOnConnect(): (() => void) | null {
    const browserAPI = getBrowserAPI();
    const onConnect = browserAPI.runtime?.onConnect;
    if (!onConnect?.addListener) {
      logger.info('LifecycleHost', 'runtime.onConnect unavailable; HAR source inert');
      return null;
    }
    const listener = (port: chrome.runtime.Port): void => {
      const tabId = parseTabId(port.name);
      if (tabId === null) return;
      this.acceptPort(tabId, port);
    };
    onConnect.addListener(listener);
    this.installed = true;
    return () => onConnect.removeListener(listener);
  }

  private acceptPort(tabId: number, port: chrome.runtime.Port): void {
    this.fanPresence({ kind: 'tab-har-active', tabId });
    port.onMessage.addListener((msg: HarSourceMessage) => {
      this.dispatchMessage(tabId, msg);
    });
    port.onDisconnect.addListener(() => {
      this.fanPresence({ kind: 'tab-har-inactive', tabId });
    });
  }

  private dispatchMessage(tabId: number, msg: HarSourceMessage): void {
    if (!msg) return;
    if (msg.type === 'har' && msg.entry) {
      this.fanHar({ kind: 'har-entry', tabId, entry: msg.entry });
      return;
    }
    if (
      msg.type === 'har-body' &&
      typeof msg.method === 'string' &&
      typeof msg.url === 'string' &&
      typeof msg.startedDateTime === 'string'
    ) {
      this.fanHar({
        kind: 'har-body',
        tabId,
        body: {
          method: msg.method,
          url: msg.url,
          startedDateTime: msg.startedDateTime,
          content: msg.content ?? '',
          encoding: msg.encoding ?? '',
        },
      });
      return;
    }
    // `nav` and `nav-timing` are not lifecycle-relevant — drop here.
    // The legacy inspector-port path still consumes them via its own
    // listener for the panel UI.
  }

  private fanHar(event: HarEvent): void {
    for (const listener of this.harListeners) listener(event);
  }

  private fanPresence(event: HarPresenceEvent): void {
    for (const listener of this.presenceListeners) listener(event);
  }
}
