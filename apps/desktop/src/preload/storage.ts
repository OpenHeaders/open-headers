/**
 * `oh.storage.*` — the host-storage wire (get / set / getMany /
 * setMany / remove / subscribe / unsubscribe + `onChange` for incoming
 * change events). Backed by main-process `FileBackedHostStorage` and
 * routed through `createHostStorageDispatcher`; sensitive slots are
 * transparently encrypted at rest via Electron `safeStorage`.
 */

import { ipcRenderer } from 'electron';

const STORAGE_CHANNEL = {
  get: 'oh:storage:get',
  set: 'oh:storage:set',
  getMany: 'oh:storage:getMany',
  setMany: 'oh:storage:setMany',
  remove: 'oh:storage:remove',
  subscribe: 'oh:storage:subscribe',
  unsubscribe: 'oh:storage:unsubscribe',
  change: 'oh:storage:change',
} as const;

export interface StorageChangeEnvelope {
  key: string;
  value: unknown;
  seq: number;
}

export const storage = {
  get(req: { key: string }): Promise<{ value: unknown; seq: number }> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.get, req) as Promise<{ value: unknown; seq: number }>;
  },
  set(req: { key: string; value: unknown }): Promise<{ seq: number }> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.set, req) as Promise<{ seq: number }>;
  },
  getMany(req: { keys: string[] }): Promise<{ entries: Array<{ key: string; value: unknown; seq: number }> }> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.getMany, req) as Promise<{
      entries: Array<{ key: string; value: unknown; seq: number }>;
    }>;
  },
  setMany(req: {
    writes: Array<{ key: string; value: unknown }>;
  }): Promise<{ seqs: Array<{ key: string; seq: number }> }> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.setMany, req) as Promise<{
      seqs: Array<{ key: string; seq: number }>;
    }>;
  },
  remove(req: { keys: string[] }): Promise<{ seqs: Array<{ key: string; seq: number }> }> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.remove, req) as Promise<{
      seqs: Array<{ key: string; seq: number }>;
    }>;
  },
  subscribe(req: {
    key: string;
    lastSeenSeq?: number;
  }): Promise<{ value: unknown; seq: number; stale: boolean }> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.subscribe, req) as Promise<{
      value: unknown;
      seq: number;
      stale: boolean;
    }>;
  },
  unsubscribe(req: { key: string }): Promise<void> {
    return ipcRenderer.invoke(STORAGE_CHANNEL.unsubscribe, req) as Promise<void>;
  },
  onChange(handler: (envelope: StorageChangeEnvelope) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, envelope: StorageChangeEnvelope): void => {
      handler(envelope);
    };
    ipcRenderer.on(STORAGE_CHANNEL.change, listener);
    return () => {
      ipcRenderer.removeListener(STORAGE_CHANNEL.change, listener);
    };
  },
};
