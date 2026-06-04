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
 * Cohabitation: `startDevtoolsPageNavBridge` (page-port-host) also
 * registers a `chrome.runtime.onConnect` listener for the same port
 * name. Chrome dispatches both listeners on every connect with the
 * same `Port` object; each adapter consumes a disjoint subset of
 * {@link HarSourceMessage} (this one reads `har` / `har-body`, the
 * bridge reads `nav` / `nav-timing`). Single-purpose adapters by
 * design — no shared state, no ordering coupling.
 *
 * Cross-browser: uses `getBrowserAPI()` for Firefox/Chrome/Safari/Edge.
 */

import { type HarSourceMessage, parseHarSourcePortName } from '@openheaders/core/types';
import type {
  HarEvent,
  HarEventSource,
  HarPresenceEvent,
  HarPresenceSource,
} from '@openheaders/oracle/correlator-heuristic';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';

type HarListener = (event: HarEvent) => void;
type PresenceListener = (event: HarPresenceEvent) => void;

export class ChromeHarEventSource implements HarEventSource, HarPresenceSource {
  private readonly harListeners = new Set<HarListener>();
  private readonly presenceListeners = new Set<PresenceListener>();
  private readonly removeOnConnect: (() => void) | null;

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
  }

  private installOnConnect(): (() => void) | null {
    const browserAPI = getBrowserAPI();
    const onConnect = browserAPI.runtime?.onConnect;
    if (!onConnect?.addListener) {
      logger.info('LifecycleHost', 'runtime.onConnect unavailable; HAR source inert');
      return null;
    }
    const listener = (port: chrome.runtime.Port): void => {
      const tabId = parseHarSourcePortName(port.name);
      if (tabId === null) return;
      this.acceptPort(tabId, port);
    };
    onConnect.addListener(listener);
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
    // The page-stream-hub path consumes them via `startDevtoolsPageNavBridge`
    // (cohabitating on this same port name, disjoint message subset).
  }

  private fanHar(event: HarEvent): void {
    for (const listener of this.harListeners) listener(event);
  }

  private fanPresence(event: HarPresenceEvent): void {
    for (const listener of this.presenceListeners) listener(event);
  }
}
