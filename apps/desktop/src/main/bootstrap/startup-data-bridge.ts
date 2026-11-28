/**
 * Synchronous startup-data bridge. The preload calls
 * `ipcRenderer.sendSync('oh:startup-data')` at load time so
 * `window.oh.startupData` is populated before the first HTML script
 * runs — no async roundtrip in the first-paint critical path.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { app, ipcMain, nativeTheme } from 'electron';
import { channelOfVersion, type UpdateChannel } from '../update-feed';
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
  /** The update channel this build was released on: what an install follows until one is chosen. */
  updateChannelDefault: UpdateChannel;
  /** This install is a Windows package: the renderer registers what only a package has. */
  windowsPackage: boolean;
  /** This install can remove its own data folder: a Windows package running on that folder. */
  localDataRemoval: boolean;
  /** This install came from the classic Windows installer: it can switch to the Windows package. */
  packageSwitch: boolean;
  /** This start took in the data a move from the classic install handed over. */
  packageDataTakenIn: boolean;
  /** Where a move's data still lies while this package runs on a folder of its own; null where none was left. */
  packageDataLeftAt: string | null;
};

/** What only the start itself knows: read before the data folder was chosen. */
export type StartFacts = Pick<StartupData, 'packageDataTakenIn' | 'packageDataLeftAt'>;

function build(start: StartFacts): StartupData {
  return {
    ...start,
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
    updateChannelDefault: channelOfVersion(app.getVersion()),
    windowsPackage: installKind() === 'msix',
    localDataRemoval:
      localDataRemovalTarget({
        installKind: installKind(),
        userDataOverride: process.env.OPENHEADERS_USER_DATA_DIR,
        localAppDataDir: process.env.LOCALAPPDATA,
        homeDir: homedir(),
      }) !== null,
    packageSwitch: installKind() === 'nsis',
  };
}

export function installStartupDataBridge(start: StartFacts): void {
  ipcMain.on('oh:startup-data', (event) => {
    event.returnValue = build(start);
  });
}
