/**
 * Per-window security hardening, plus the app-wide permission policy.
 *
 * Two per-window guards, both default-on:
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
 *
 * The permission policy is session-wide (every window rides the default
 * session — no partitions anywhere): an explicit allowlist of the two
 * permissions the workbench actually uses, everything else denied.
 */

import { type BrowserWindow, session } from 'electron';
import { createLogger } from './logger';

const logger = createLogger('security');

/**
 * Chromium permissions the renderer legitimately exercises:
 * `clipboard-sanitized-write` backs every copy affordance
 * (`navigator.clipboard.writeText`), `fullscreen` the response-preview
 * media controls. Camera, microphone, geolocation, notifications, and
 * the rest have no consumer — denied.
 */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen']);

/** Install the deny-by-default permission policy on the default session. */
export function installPermissionPolicy(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission);
    if (!allowed) logger.warn('denied permission request', { permission });
    callback(allowed);
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => ALLOWED_PERMISSIONS.has(permission));
}

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
