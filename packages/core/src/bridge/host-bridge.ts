/**
 * Host-bridge contract — the seam between UI code that needs to talk to
 * the host reactor (RPC + broadcast + presence) and the platform-
 * specific transport adapter that actually moves the bytes.
 *
 * Each app installs its own implementation of {@link HostBridge} once at
 * boot via {@link setHostBridge}:
 *
 *   - **Browser extension** — `chrome.runtime.sendMessage` / `connect` /
 *     `onMessage`.
 *   - **Electron desktop** — `ipcRenderer.invoke` / `webContents.send`.
 *   - **Web app** — a WebSocket to the user's local or cloud daemon;
 *     channel name + payload travel as JSON frames.
 *
 * UI code reads through the {@link hostBridge} delegating proxy and uses
 * it identically across platforms — it never imports a host adapter
 * module and never touches `chrome.*` / `ipcRenderer` directly.
 *
 * Channels are typed by the registry in `@openheaders/core/protocol`
 * ({@link BridgeRpcContract} / {@link BridgeBroadcastContract}) — the
 * same contract every host adapter and the UI bundle type against.
 */

import type {
  BridgeBroadcastPayload,
  BridgeBroadcastType,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeRpcType,
} from '../protocol/channels';

/**
 * The runtime contract every host's bridge transport must satisfy. UI
 * code only sees this interface — never the concrete adapter.
 */
export interface HostBridge {
  /**
   * Send a typed RPC to the host reactor and resolve with the typed
   * response. Rejects when the transport surfaces a structural failure
   * (no handler, context invalidated) — never silently resolves to
   * `undefined` on error.
   */
  call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>>;
  /**
   * Fire-and-forget broadcast from the host reactor to every open UI
   * surface. "No listeners" is the expected case, not an error.
   */
  broadcast<K extends BridgeBroadcastType>(
    type: K,
    ...args: BridgeBroadcastPayload<K> extends Record<string, never> ? [] : [payload: BridgeBroadcastPayload<K>]
  ): void;
  /**
   * Subscribe to a broadcast channel. The handler fires only for
   * messages whose `type` matches `subscribedType` and receives a
   * payload narrowed to that channel's contract. Returns an
   * unsubscribe function.
   */
  subscribe<K extends BridgeBroadcastType>(
    subscribedType: K,
    handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void;
  /**
   * Open a presence channel to the host reactor under `name` so the
   * host can observe this surface's open/close lifecycle. Returns a
   * disposer that cleanly closes it. Presence is advisory — failures
   * never throw.
   */
  presence(name: string): () => void;
}

let installed: HostBridge | null = null;

/**
 * Install (or replace) the host-bridge adapter. Hosts call this once at
 * boot before any UI code touches the bridge. Calling twice replaces
 * the prior implementation — tests use this to swap in a fake.
 */
export function setHostBridge(impl: HostBridge): void {
  installed = impl;
}

/** Returns the installed adapter, or null when no host has wired one yet. */
export function getHostBridge(): HostBridge | null {
  return installed;
}

/** Returns the installed adapter or throws if no host has wired one. */
export function requireHostBridge(): HostBridge {
  if (!installed) {
    throw new Error('HostBridge: no host adapter installed. Call setHostBridge at app boot.');
  }
  return installed;
}

/**
 * Delegating proxy — every call is forwarded to the currently-installed
 * host adapter. UI code imports this and uses it exactly like a concrete
 * adapter; the indirection lets each host plug in its own transport
 * without consumers caring.
 */
export const hostBridge: HostBridge = new Proxy({} as HostBridge, {
  get(_target, prop): unknown {
    const impl = requireHostBridge();
    const value = (impl as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(impl) : value;
  },
});
