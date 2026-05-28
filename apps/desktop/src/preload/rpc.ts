/**
 * `oh.invoke` / `oh.onBroadcast` — the bridge RPC channel + broadcast
 * subscription (`syncBroadcast`, `awarenessBroadcast`, plus future
 * entity-store-change broadcasts).
 */

import { ipcRenderer } from 'electron';

const RPC_CHANNEL = 'oh:rpc';
const BROADCAST_CHANNEL = 'oh:broadcast';

export interface BroadcastEnvelope {
  type: string;
  payload: unknown;
}

export const rpc = {
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
