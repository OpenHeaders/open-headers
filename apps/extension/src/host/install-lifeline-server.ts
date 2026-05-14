/**
 * Boot-time wiring: register the browser-extension's
 * `chrome.runtime.onConnect` adapter as the global lifeline-server
 * implementation.
 *
 * The background service worker imports this once at startup so oracle's
 * awareness lifeline handler — which reaches for the `lifelineServer`
 * proxy from `@openheaders/core/awareness` — lands on the chrome-backed
 * server.
 *
 * This is the host-side counterpart to `install-awareness-host.ts`'s
 * `lifelineTransport` (the renderer-side connect seam). It lives in its
 * own module because the lifeline *server* is a background-only concern
 * — only the SW listens for incoming lifelines — whereas the renderer
 * transport ships in every UI entry point.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module wiring a different server (incoming WebSocket
 * connections); the contract on the oracle side is identical, and the
 * seam degrades to a graceful no-op when no host wires it.
 */

import { type IncomingLifelinePort, type LifelineServer, setLifelineServer } from '@openheaders/core/awareness';
import { runtime } from '@/utils/browser-runtime';

/**
 * `chrome.runtime.onConnect`-backed lifeline server. `runtime.onConnect`
 * is only present in background contexts — when absent (content-script
 * import, test stub) the server degrades to a no-op, matching the
 * core seam's default.
 */
const chromeLifelineServer: LifelineServer = {
  onConnect(handler: (port: IncomingLifelinePort) => void): () => void {
    const api = runtime.onConnect;
    if (!api) return () => {};

    const listener = (port: chrome.runtime.Port): void => {
      handler({
        name: port.name,
        onMessage<T = unknown>(messageHandler: (message: T) => void): void {
          port.onMessage.addListener((raw) => messageHandler(raw as T));
        },
        onDisconnect(disconnectHandler): void {
          port.onDisconnect.addListener(() => {
            disconnectHandler({ errorMessage: runtime.lastError?.message });
          });
        },
      });
    };

    api.addListener(listener);
    return () => api.removeListener(listener);
  },
};

setLifelineServer(chromeLifelineServer);
