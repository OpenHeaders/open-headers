/**
 * `openheaders://...` deep-link plumbing. Initial-launch URLs arrive
 * via argv (Windows / Linux) or `open-url` (macOS). A second launch
 * with a URL routes through the running instance via `second-instance`
 * (works because the single-instance lock owns the original process).
 *
 * URLs received before the renderer-side handler is wired are buffered
 * and drained when the window exists; v5's invite / env-import flows
 * land in a later slice.
 */

import { app } from 'electron';
import { createLogger } from './logger';
import { getMainWindow, showMainWindow } from './window-manager';

const logger = createLogger('protocol');

const PROTOCOL_SCHEME = 'openheaders';

const pendingProtocolUrls: string[] = [];

function rememberProtocolUrl(url: string | undefined): void {
  if (!url || !url.startsWith(`${PROTOCOL_SCHEME}://`)) return;
  pendingProtocolUrls.push(url);
}

function findProtocolUrlInArgv(argv: readonly string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
}

export function drainPendingProtocolUrls(): void {
  if (pendingProtocolUrls.length === 0) return;
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  for (const url of pendingProtocolUrls.splice(0)) {
    logger.info('protocol url received:', url);
  }
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
