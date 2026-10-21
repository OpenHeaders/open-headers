/**
 * `oh.downloads.*` — the saved-download toast's "Show in folder": ask
 * main to reveal a file it reported through the `downloadDone`
 * broadcast. Main reveals only paths it reported itself.
 */

import { ipcRenderer } from 'electron';

const REVEAL_CHANNEL = 'oh:downloads:reveal';

export const downloads = {
  reveal(path: string): Promise<void> {
    return ipcRenderer.invoke(REVEAL_CHANNEL, path) as Promise<void>;
  },
};
