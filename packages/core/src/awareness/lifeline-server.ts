/**
 * Lifeline-server contract — the host-side counterpart to
 * {@link LifelineTransport}. The renderer opens one long-lived
 * connection-bound channel per surface; the host listens for those
 * connections and treats each disconnect as the canonical "this surface
 * is gone" signal (connection-bound liveness instead of
 * heartbeat-with-TTL polling).
 *
 * Each host installs its own implementation once at boot via
 * {@link setLifelineServer}:
 *
 *   - **Browser extension** — `chrome.runtime.onConnect`; each
 *     `chrome.runtime.Port` is one incoming lifeline.
 *   - **Electron desktop** / **web app** — incoming WebSocket
 *     connections; `onclose` replaces `Port.onDisconnect`, identical
 *     semantics.
 *
 * Like {@link LifelineTransport} this seam degrades gracefully: the
 * default server never fires `onConnect`, so an unwired host simply
 * never sees lifelines — connection-bound liveness is lost, awareness
 * still works through the regular publish path. No test wiring needed.
 */

/**
 * One incoming lifeline connection, host-side. Mirrors the subset of
 * `chrome.runtime.Port` the awareness lifeline handler actually uses,
 * transport-agnostic.
 */
export interface IncomingLifelinePort {
  /** Port name the renderer set at connect time. */
  readonly name: string;
  /**
   * Stream a message down to the renderer end of the port. Data-bearing
   * lifelines (the request-lifecycle pipe) are host→surface push
   * channels, so the host side sends on the same port the surface
   * opened. Best-effort: a frame posted after the port dropped is
   * silently discarded — the disconnect handler is the loss signal.
   */
  postMessage(message: unknown): void;
  /**
   * Register a handler for messages the renderer streams up this port.
   * The transport delivers raw frames, so `T` is the caller's typed
   * assertion about the stream.
   */
  onMessage<T = unknown>(handler: (message: T) => void): void;
  /**
   * Register a handler for the renderer closing the connection (surface
   * unmount, tab close, navigation) or the transport dropping it. The
   * handler receives the transport's error message when one is
   * available.
   */
  onDisconnect(handler: (info: { errorMessage?: string }) => void): void;
}

/** Listens for incoming lifeline connections from renderer surfaces. */
export interface LifelineServer {
  /**
   * Register a handler invoked once per incoming lifeline connection.
   * Returns an unsubscribe function that detaches the handler.
   */
  onConnect(handler: (port: IncomingLifelinePort) => void): () => void;
}

/**
 * Default server — never fires `onConnect`. Hosts that don't wire a real
 * server lose connection-bound liveness but stay functional.
 */
const NULL_LIFELINE_SERVER: LifelineServer = {
  onConnect() {
    return () => {};
  },
};

let installed: LifelineServer = NULL_LIFELINE_SERVER;

/**
 * Install (or replace) the lifeline server. Hosts call this once at
 * boot; tests use it to swap in a fake.
 */
export function setLifelineServer(impl: LifelineServer): void {
  installed = impl;
}

/** Returns the installed server (the no-op default when unwired). */
export function getLifelineServer(): LifelineServer {
  return installed;
}

/**
 * Delegating proxy — every call forwards to the currently-installed
 * server. The host reactor imports this and uses it identically across
 * platforms.
 */
export const lifelineServer: LifelineServer = new Proxy({} as LifelineServer, {
  get(_target, prop): unknown {
    const value = (installed as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(installed) : value;
  },
});
