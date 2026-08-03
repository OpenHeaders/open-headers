/**
 * `oh.openExternal(url)` — proxy for `shell.openExternal` on main.
 * Used by UI affordances ("Open Documentation", "Report an Issue") that
 * would otherwise be blocked by the window security guard.
 *
 * Allowed schemes: `http(s)` and `mailto`. Main rejects anything else.
 *
 * `oh.openInBrowser(url, browser)` targets a NAMED browser (the
 * extension-install CTAs); main falls back to the default browser when
 * the named one isn't installed. http(s) only.
 *
 * `oh.revealInFolder(path)` shows one of the app's own files in the OS
 * file manager — main refuses anything outside the app data directory.
 */

import { ipcRenderer } from 'electron';

const CHANNEL = 'oh:open-external';
const BROWSER_CHANNEL = 'oh:open-in-browser';
const REVEAL_CHANNEL = 'oh:reveal-in-folder';

export interface OpenExternalResult {
  ok: boolean;
  error?: string;
}

export type InstallTargetBrowser = 'chrome' | 'edge' | 'firefox';

export const externalLinks = {
  openExternal(url: string): Promise<OpenExternalResult> {
    return ipcRenderer.invoke(CHANNEL, url) as Promise<OpenExternalResult>;
  },
  openInBrowser(url: string, browser: InstallTargetBrowser): Promise<OpenExternalResult> {
    return ipcRenderer.invoke(BROWSER_CHANNEL, url, browser) as Promise<OpenExternalResult>;
  },
  revealInFolder(path: string): Promise<OpenExternalResult> {
    return ipcRenderer.invoke(REVEAL_CHANNEL, path) as Promise<OpenExternalResult>;
  },
};
