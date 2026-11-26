/**
 * `oh.packageAliases.*` — the Windows package's two launch aliases as
 * Windows keeps them now, and the Windows Settings page that holds their
 * switches. Backs the renderer's `packageAliases` capability, which only
 * a Windows package registers.
 */

import { ipcRenderer } from 'electron';

const READ_CHANNEL = 'oh:package-aliases:read';
const OPEN_SETTINGS_CHANNEL = 'oh:package-aliases:open-settings';

interface AliasState {
  on: boolean;
  name: string;
}

export const packageAliases = {
  read(): Promise<{ app: AliasState; helper: AliasState }> {
    return ipcRenderer.invoke(READ_CHANNEL) as Promise<{ app: AliasState; helper: AliasState }>;
  },
  openSettings(): Promise<void> {
    return ipcRenderer.invoke(OPEN_SETTINGS_CHANNEL) as Promise<void>;
  },
};
