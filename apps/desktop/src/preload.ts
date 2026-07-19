/**
 * Desktop preload — thin orchestrator. Composes the per-namespace
 * surfaces from `./preload/` and exposes them as `window.oh.*` through
 * `contextBridge`. The renderer's host adapters
 * (`renderer/host/ipc-bridge.ts`, `renderer/host/ipc-host-storage.ts`)
 * talk to `window.oh.*`; nothing outside those adapters should reference
 * `ipcRenderer` directly.
 */

import 'electron-log/preload';
import { contextBridge } from 'electron';
import { externalLinks } from './preload/external-links';
import { lifeline } from './preload/lifeline';
import { protocol } from './preload/protocol';
import { type BroadcastEnvelope, rpc } from './preload/rpc';
import { type StartupData, startupData } from './preload/startup-data';
import { type StorageChangeEnvelope, storage } from './preload/storage';
import { terminal } from './preload/terminal';

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
  openExternal: externalLinks.openExternal,
  protocol,
  terminal,
};

contextBridge.exposeInMainWorld('oh', api);

export type OhBridgeApi = typeof api;
export type { BroadcastEnvelope, StartupData, StorageChangeEnvelope };
