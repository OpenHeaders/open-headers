/**
 * `oh.openExternal(url)` — proxy for `shell.openExternal` on main.
 * Used by UI affordances ("Open Documentation", "Report an Issue") that
 * would otherwise be blocked by the window security guard.
 *
 * Allowed schemes: `http(s)` and `mailto`. Main rejects anything else.
 */

import { ipcRenderer } from 'electron';

const CHANNEL = 'oh:open-external';

export interface OpenExternalResult {
  ok: boolean;
  error?: string;
}

export const externalLinks = {
  openExternal(url: string): Promise<OpenExternalResult> {
    return ipcRenderer.invoke(CHANNEL, url) as Promise<OpenExternalResult>;
  },
};
