/**
 * `oh.logs.reveal()` — reveal `main.log` in the OS file manager. Backs
 * the renderer's `revealLogs` capability: the root error fallback's
 * "Open logs folder", where the error funnel's lines landed.
 */

import { ipcRenderer } from 'electron';

const CHANNEL = 'oh:logs:reveal';

export const logs = {
  reveal(): Promise<void> {
    return ipcRenderer.invoke(CHANNEL) as Promise<void>;
  },
};
