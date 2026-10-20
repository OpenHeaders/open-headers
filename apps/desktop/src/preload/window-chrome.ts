/**
 * `oh.windowChrome.apply(palette)` — hand main the top bar's palette
 * under the renderer's resolved theme, for the Windows / Linux
 * title-bar overlay. Backs the renderer's `applyWindowChrome`
 * capability; the mode itself main reads from the settings blob.
 */

import { ipcRenderer } from 'electron';

const CHANNEL = 'oh:window-chrome:apply';

export interface WindowChromePalette {
  background: string;
  symbolColor: string;
}

export const windowChrome = {
  apply(palette: WindowChromePalette): Promise<void> {
    return ipcRenderer.invoke(CHANNEL, palette) as Promise<void>;
  },
};
