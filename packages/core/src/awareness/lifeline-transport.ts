/**
 * Lifeline-transport contract — the seam between awareness UI code that
 * needs a long-lived liveness channel to the host reactor and the
 * platform-specific transport that actually carries it.
 *
 * The renderer-side awareness lifeline opens one long-lived connection
 * for a surface's lifetime; the host treats its disconnect as the
 * canonical "this surface is gone" signal (connection-bound liveness
 * instead of heartbeat-with-TTL polling).
 *
 * Each app installs its own implementation once at boot via
 * {@link setLifelineTransport}:
 *
 *   - **Browser extension** — a `chrome.runtime.Port`.
 *   - **Electron desktop** / **web app** — a WebSocket frame; `onclose`
 *     replaces `Port.onDisconnect`, identical semantics.
 *
 * Unlike the host-bridge / host-logger seams this one degrades
 * gracefully: the default transport is a no-op. An unwired host simply
 * loses the connection-bound liveness optimization — awareness still
 * works through the regular publish path — so no test wiring is needed.
 */

/**
 * One open lifeline connection. Mirrors the subset of `chrome.runtime.Port`
 * the renderer lifeline actually uses, transport-agnostic.
 */
export interface LifelinePort {
  /** Send a message to the host end of the lifeline. Best-effort. */
  postMessage(message: unknown): void;
  /**
   * Register a handler for the host closing the connection (or the
   * transport dropping it — e.g. MV3 service-worker eviction). The
   * handler receives the transport's error message when one is
   * available.
   */
  onDisconnect(handler: (info: { errorMessage?: string }) => void): void;
  /** Tear the port down from the renderer side. Idempotent. */
  disconnect(): void;
}

/** Opens named lifeline ports to the host reactor. */
export interface LifelineTransport {
  connect(name: string): LifelinePort;
}

const NULL_LIFELINE_PORT: LifelinePort = {
  postMessage() {},
  onDisconnect() {},
  disconnect() {},
};

/**
 * Default transport — every `connect` returns an inert port. Hosts that
 * don't wire a real transport lose connection-bound liveness but stay
 * functional.
 */
const NULL_LIFELINE_TRANSPORT: LifelineTransport = {
  connect() {
    return NULL_LIFELINE_PORT;
  },
};

let installed: LifelineTransport = NULL_LIFELINE_TRANSPORT;

/**
 * Install (or replace) the lifeline transport. Hosts call this once at
 * boot; tests use it to swap in a fake.
 */
export function setLifelineTransport(impl: LifelineTransport): void {
  installed = impl;
}

/** Returns the installed transport (the no-op default when unwired). */
export function getLifelineTransport(): LifelineTransport {
  return installed;
}

/**
 * Delegating proxy — every call forwards to the currently-installed
 * transport. Awareness UI code imports this and uses it identically
 * across platforms.
 */
export const lifelineTransport: LifelineTransport = new Proxy({} as LifelineTransport, {
  get(_target, prop): unknown {
    const value = (installed as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(installed) : value;
  },
});
