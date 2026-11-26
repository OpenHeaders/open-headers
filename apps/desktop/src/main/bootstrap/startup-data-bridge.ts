/**
 * Synchronous startup-data bridge. The preload calls
 * `ipcRenderer.sendSync('oh:startup-data')` at load time so
 * `window.oh.startupData` is populated before the first HTML script
 * runs — no async roundtrip in the first-paint critical path.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { app, ipcMain, nativeTheme } from 'electron';
import { installKind } from './install-kind';
import { localDataRemovalTarget } from './local-data-removal';
import { mcpClientCommand } from './package-aliases';

export type StartupData = {
  platform: NodeJS.Platform;
  version: string;
  isPackaged: boolean;
  locale: string;
  theme: 'light' | 'dark';
  /** The command an MCP client runs to reach this install; null where the standard location is shown. */
  mcpClientCommand: string | null;
  /** This install is a Windows package: the renderer registers what only a package has. */
  windowsPackage: boolean;
  /** This install can remove its own data folder: a Windows package running on that folder. */
  localDataRemoval: boolean;
};

function build(): StartupData {
  return {
    platform: process.platform,
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    locale: app.getLocale(),
    theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    mcpClientCommand: mcpClientCommand({
      installKind: installKind(),
      executablePath: process.execPath,
      localAppDataDir: process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
    }),
    windowsPackage: installKind() === 'msix',
    localDataRemoval:
      localDataRemovalTarget({
        installKind: installKind(),
        userDataOverride: process.env.OPENHEADERS_USER_DATA_DIR,
        localAppDataDir: process.env.LOCALAPPDATA,
        homeDir: homedir(),
      }) !== null,
  };
}

export function installStartupDataBridge(): void {
  ipcMain.on('oh:startup-data', (event) => {
    event.returnValue = build();
  });
}
