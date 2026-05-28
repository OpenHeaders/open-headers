/**
 * Synchronous startup-data bridge. The preload calls
 * `ipcRenderer.sendSync('oh:startup-data')` at load time so
 * `window.oh.startupData` is populated before the first HTML script
 * runs — no async roundtrip in the first-paint critical path.
 */

import { app, ipcMain, nativeTheme } from 'electron';

export type StartupData = {
  platform: NodeJS.Platform;
  version: string;
  isPackaged: boolean;
  locale: string;
  theme: 'light' | 'dark';
};

function build(): StartupData {
  return {
    platform: process.platform,
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    locale: app.getLocale(),
    theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  };
}

export function installStartupDataBridge(): void {
  ipcMain.on('oh:startup-data', (event) => {
    event.returnValue = build();
  });
}
