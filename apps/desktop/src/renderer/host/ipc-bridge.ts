/**
 * Real {@link HostBridge} for the desktop renderer — talks to the
 * main-process engine host over `window.oh.invoke` /
 * `window.oh.onBroadcast` (set up by `src/preload.ts`).
 *
 * Surface:
 *   - `call(type, payload)` → `oh.invoke({ type, ...payload })`.
 *     Rejects with the structured error main returns when the RPC
 *     isn't yet implemented on the desktop side.
 *   - `subscribe(type, handler)` filters main → renderer broadcasts
 *     by envelope `type` and forwards the payload.
 *   - `broadcast(type, payload)` is a no-op today — renderer-emitted
 *     broadcasts are unusual in this architecture; if a use case
 *     surfaces we'll add a dedicated `oh:rebroadcast` IPC channel.
 *   - `presence(name)` is a no-op until the lifeline IPC channel lands.
 */

import type {
  BridgeBroadcastPayload,
  BridgeBroadcastType,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeRpcType,
  HostBridge,
} from '@openheaders/core/bridge';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'IpcBridge';

interface BroadcastEnvelope {
  type: string;
  payload: unknown;
}

interface OhPreloadApi {
  invoke(message: Record<string, unknown>): Promise<unknown>;
  onBroadcast(handler: (envelope: BroadcastEnvelope) => void): () => void;
}

function ohApi(): OhPreloadApi {
  const api = (globalThis as { oh?: OhPreloadApi }).oh;
  if (!api) {
    throw new Error('IpcBridge: window.oh is not exposed (preload script did not run)');
  }
  return api;
}

// Single source of truth for incoming broadcasts. Renderer-side
// subscribers are demuxed by envelope type — we keep one upstream
// listener on the preload bridge to avoid `onBroadcast` registration
// overhead per subscribe.
type BroadcastListener = (payload: unknown) => void;
const broadcastListeners = new Map<string, Set<BroadcastListener>>();
let upstreamUnsubscribe: (() => void) | null = null;

function ensureUpstreamSubscription(): void {
  if (upstreamUnsubscribe) return;
  upstreamUnsubscribe = ohApi().onBroadcast((envelope) => {
    const bucket = broadcastListeners.get(envelope.type);
    if (!bucket) return;
    for (const listener of bucket) {
      try {
        listener(envelope.payload);
      } catch (err) {
        logger.warn(SCOPE, `broadcast subscriber for ${envelope.type} threw:`, err);
      }
    }
  });
}

export const ipcBridge: HostBridge = {
  async call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>> {
    const payload = (args[0] ?? {}) as Record<string, unknown>;
    const response = (await ohApi().invoke({ type, ...payload })) as
      | { __error: string }
      | BridgeRpcResponse<K>;
    if (response && typeof response === 'object' && '__error' in response) {
      throw new Error((response as { __error: string }).__error);
    }
    return response as BridgeRpcResponse<K>;
  },
  broadcast<K extends BridgeBroadcastType>(
    _type: K,
    ..._args: BridgeBroadcastPayload<K> extends Record<string, never> ? [] : [payload: BridgeBroadcastPayload<K>]
  ): void {
    // Renderer-emitted broadcasts are not in scope yet. The main
    // process is the sole publisher; everything reaches the renderer
    // through `onBroadcast`. If a renderer-driven fan-out becomes
    // necessary, expose an `oh:rebroadcast` channel in the preload
    // and route through ipcRenderer.send.
  },
  subscribe<K extends BridgeBroadcastType>(
    subscribedType: K,
    handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void {
    ensureUpstreamSubscription();
    const key = String(subscribedType);
    const bucket = broadcastListeners.get(key) ?? new Set<BroadcastListener>();
    const listener: BroadcastListener = (payload) => handler(payload as BridgeBroadcastPayload<K>);
    bucket.add(listener);
    broadcastListeners.set(key, bucket);
    return () => {
      const current = broadcastListeners.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) broadcastListeners.delete(key);
    };
  },
  presence(_name: string): () => void {
    // Lifeline-port IPC lands in a follow-up commit; until then the
    // renderer doesn't hold a presence ref.
    return () => undefined;
  },
};
