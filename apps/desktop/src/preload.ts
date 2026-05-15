/**
 * Desktop app preload — exposes a narrow renderer↔main RPC surface
 * through `contextBridge`. The renderer's `HostBridge` adapter
 * (`renderer/host/ipc-bridge.ts`) talks to `window.oh.*`; nothing
 * outside that adapter should reference these calls directly.
 *
 * Surface:
 *   - `oh.invoke(message)` — ipcRenderer.invoke('oh:rpc', message).
 *     Returns the main-side dispatcher's response.
 *   - `oh.onBroadcast(handler)` — subscribe to main → renderer
 *     broadcasts (`syncBroadcast`, `awarenessBroadcast`, plus future
 *     entity-store-change broadcasts). Returns an unsubscribe fn.
 */

import { contextBridge, ipcRenderer } from 'electron';

const RPC_CHANNEL = 'oh:rpc';
const BROADCAST_CHANNEL = 'oh:broadcast';

export interface BroadcastEnvelope {
  type: string;
  payload: unknown;
}

const api = {
  invoke(message: Record<string, unknown>): Promise<unknown> {
    return ipcRenderer.invoke(RPC_CHANNEL, message);
  },
  onBroadcast(handler: (envelope: BroadcastEnvelope) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, envelope: BroadcastEnvelope): void => {
      handler(envelope);
    };
    ipcRenderer.on(BROADCAST_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(BROADCAST_CHANNEL, listener);
    };
  },
};

contextBridge.exposeInMainWorld('oh', api);

export type OhBridgeApi = typeof api;
