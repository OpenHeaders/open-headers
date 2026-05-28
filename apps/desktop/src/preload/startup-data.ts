/**
 * Synchronous startup-data read. The matching `ipcMain.on` handler in
 * `main/bootstrap/startup-data-bridge.ts` registers before window
 * creation, so this `sendSync` resolves on the first event-loop tick
 * of the renderer process — `window.oh.startupData` is populated
 * before any HTML script runs.
 */

import { ipcRenderer } from 'electron';

export type StartupData = {
  platform: NodeJS.Platform;
  version: string;
  isPackaged: boolean;
  locale: string;
  theme: 'light' | 'dark';
};

export const startupData = ipcRenderer.sendSync('oh:startup-data') as StartupData;
