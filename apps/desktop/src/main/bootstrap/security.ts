/**
 * Per-window security hardening.
 *
 * Two guards, both default-on:
 *   - `setWindowOpenHandler` denies every `window.open` / `target=
 *     "_blank"` / `shell` request from the renderer. Legitimate "open in
 *     browser" affordances must go through a dedicated RPC that calls
 *     `shell.openExternal` in the main process.
 *   - `will-navigate` + `will-redirect` block top-level navigation away
 *     from our own URL (vite-dev or `file://` bundle). Vite HMR uses
 *     module-graph updates, not navigation events, so HMR keeps working.
 *
 * Re-attach for every BrowserWindow created (primary tray window plus
 * any future per-workspace windows).
 */

import type { BrowserWindow } from 'electron';
import { createLogger } from './logger';

const logger = createLogger('security');

function isAllowedUrl(url: string): boolean {
  // Dev: Vite dev server bound to localhost.
  // Prod: bundled assets loaded via `file://`.
  return url.startsWith('http://localhost:') || url.startsWith('file://');
}

export function attachWindowSecurity(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    logger.warn('blocked window.open', { url });
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    logger.warn('blocked navigation', { url });
  });

  win.webContents.on('will-redirect', (event, url) => {
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    logger.warn('blocked redirect', { url });
  });
}
