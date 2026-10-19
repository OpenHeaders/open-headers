/**
 * `oh.appMenu.popup(anchor)` — pop the application menu under the top
 * bar's menu button. Backs the renderer's `openAppMenu` capability on
 * Windows / Linux, whose frameless windows have no native menu bar.
 */

import { ipcRenderer } from 'electron';

const CHANNEL = 'oh:app-menu:popup';

export const appMenu = {
  popup(anchor: { x: number; y: number }): Promise<void> {
    return ipcRenderer.invoke(CHANNEL, anchor) as Promise<void>;
  },
};
