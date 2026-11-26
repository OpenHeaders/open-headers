/**
 * Main-side handlers for the renderer's `packageAliases` capability: the
 * two launch aliases as Windows keeps them now, and the Windows Settings
 * page a person switches them on from. Installed in a Windows package
 * alone — no other install has aliases, and its renderer never asks.
 */

import { homedir, release } from 'node:os';
import { join } from 'node:path';
import { ipcMain, shell } from 'electron';
import type { InstallKind } from './install-kind';
import { aliasSettingsLink, packageAliasStates } from './package-aliases';

const READ_CHANNEL = 'oh:package-aliases:read';
const OPEN_SETTINGS_CHANNEL = 'oh:package-aliases:open-settings';

export function installPackageAliasHandlers(installKind: InstallKind | null): void {
  if (installKind !== 'msix') return;
  const localAppDataDir = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  ipcMain.handle(READ_CHANNEL, () => packageAliasStates({ localAppDataDir }));
  ipcMain.handle(OPEN_SETTINGS_CHANNEL, () => shell.openExternal(aliasSettingsLink(release())));
}
