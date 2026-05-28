/**
 * `openheaders://...` deep-link plumbing. Initial-launch URLs arrive
 * via argv (Windows / Linux) or `open-url` (macOS). A second launch
 * with a URL routes through the running instance via `second-instance`
 * (works because the single-instance lock owns the original process).
 *
 * URLs received before the renderer is ready to receive (no window yet,
 * or the renderer's `did-finish-load` hasn't fired) are buffered. The
 * window-manager calls `markRendererReadyAndDrain()` once the renderer
 * load completes; from then on every incoming URL is forwarded to the
 * `oh:protocol:url` channel directly.
 *
 * When the window hides + reshows, the renderer keeps its IPC
 * subscription, so we leave `rendererReady` true until the webContents
 * is replaced (window destroyed and recreated).
 */

import { app, type BrowserWindow } from 'electron';
import { createLogger } from './logger';
import { getMainWindow, showMainWindow } from './window-manager';

const logger = createLogger('protocol');

const PROTOCOL_SCHEME = 'openheaders';
const PROTOCOL_URL_CHANNEL = 'oh:protocol:url';

const pendingProtocolUrls: string[] = [];
let rendererReady = false;

function rememberProtocolUrl(url: string | undefined): void {
  if (!url || !url.startsWith(`${PROTOCOL_SCHEME}://`)) return;
  pendingProtocolUrls.push(url);
}

function findProtocolUrlInArgv(argv: readonly string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
}

function sendUrlToWindow(win: BrowserWindow, url: string): void {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send(PROTOCOL_URL_CHANNEL, url);
}

export function drainPendingProtocolUrls(): void {
  if (!rendererReady || pendingProtocolUrls.length === 0) return;
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  for (const url of pendingProtocolUrls.splice(0)) {
    logger.info('dispatching protocol url to renderer', url);
    sendUrlToWindow(win, url);
  }
}

/**
 * Called by the window-manager from `webContents.on('did-finish-load')`
 * once the renderer's IPC subscription is in place. Idempotent — fires
 * again on dev hot-reload reloads, which is the right time to re-flush
 * anything queued during the reload window.
 */
export function markRendererReadyAndDrain(): void {
  rendererReady = true;
  drainPendingProtocolUrls();
}

/**
 * Reset when the window's webContents is gone (close + recreate path
 * from `showMainWindow` after a hard destroy). The next renderer load
 * will call `markRendererReadyAndDrain` again.
 */
export function resetRendererReady(): void {
  rendererReady = false;
}

export function installProtocolHandler(): void {
  rememberProtocolUrl(findProtocolUrlInArgv(process.argv));

  // macOS deep links — must be registered before `whenReady` to catch
  // the very first event.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    rememberProtocolUrl(url);
    drainPendingProtocolUrls();
    showMainWindow();
  });

  // A second launch hits this in the first instance (single-instance
  // lock is already held). Surface the window and pick up any deep
  // link the new argv carried.
  app.on('second-instance', (_event, argv) => {
    rememberProtocolUrl(findProtocolUrlInArgv(argv));
    drainPendingProtocolUrls();
    showMainWindow();
  });
}

/**
 * Register the app as the OS handler for `openheaders://`. In dev
 * `process.defaultApp` is true and Windows needs the electron.exe path
 * plus the project path; packaged builds use the exe path implicitly.
 */
export function registerAsProtocolHandler(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  }
}
