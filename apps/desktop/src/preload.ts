/**
 * Desktop preload — thin orchestrator. Composes the per-namespace
 * surfaces from `./preload/` and exposes them as `window.oh.*` through
 * `contextBridge`. The renderer's host adapters
 * (`renderer/host/ipc-bridge.ts`, `renderer/host/ipc-host-storage.ts`)
 * talk to `window.oh.*`; nothing outside those adapters should reference
 * `ipcRenderer` directly.
 */

import { contextBridge } from 'electron';
import { lifeline } from './preload/lifeline';
import { rpc, type BroadcastEnvelope } from './preload/rpc';
import { startupData, type StartupData } from './preload/startup-data';
import { storage, type StorageChangeEnvelope } from './preload/storage';

const api = {
  /**
   * Authoritative OS family for the renderer. Used by the title-bar
   * reservation CSS in `src/renderer/index.html` (different inset for
   * macOS traffic lights vs the Windows / Linux `titleBarOverlay`
   * buttons). `navigator.platform` is unreliable on modern Chromium;
   * `process.platform` is.
   */
  platform: process.platform as NodeJS.Platform,
  startupData,
  invoke: rpc.invoke,
  onBroadcast: rpc.onBroadcast,
  storage,
  lifeline,
};

contextBridge.exposeInMainWorld('oh', api);

export type OhBridgeApi = typeof api;
export type { BroadcastEnvelope, StartupData, StorageChangeEnvelope };
