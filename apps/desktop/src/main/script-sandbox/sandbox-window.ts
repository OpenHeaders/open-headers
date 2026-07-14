/**
 * Hidden script-sandbox window — the Electron lifecycle half of the
 * desktop's Safe-mode script runtime. Owns exactly one invisible
 * BrowserWindow that loads `renderer/sandbox.html` (the React-free
 * runner page) under the hardest renderer posture we have:
 * `sandbox: true`, context isolation, no Node integration, and only
 * the minimal `preload/sandbox.js` postMessage bridge.
 *
 * The host-neutral broker (`@openheaders/oracle-host-node/daemon`)
 * drives this through the {@link SandboxTransport} seam so its
 * lifecycle/timeout/tiering logic unit-tests against a fake transport:
 *   • created lazily on the first `ensureReady()`, reused after;
 *   • a crashed/killed renderer (`render-process-gone`) drops the
 *     handle, so the next run respawns a fresh window;
 *   • `close()` destroys the window (idle timer / shutdown).
 *
 * IPC channels mirror `src/preload/sandbox.ts` verbatim: the preload
 * forwards the page's `sandbox.ready` / `script.result` /
 * `script.host-request` posts up on `oh:script-sandbox:up`, and relays
 * whatever arrives on `oh:script-sandbox:down` back into the page.
 */

import { join } from 'node:path';
import type { SandboxTransport } from '@openheaders/oracle-host-node/daemon';
import { BrowserWindow, ipcMain } from 'electron';
import { createLogger } from '../bootstrap/logger';
import { attachWindowSecurity } from '../bootstrap/security';

const logger = createLogger('script-sandbox');

const UP_CHANNEL = 'oh:script-sandbox:up';
const DOWN_CHANNEL = 'oh:script-sandbox:down';

export function createSandboxWindowTransport(onUp: (message: unknown) => void): SandboxTransport {
  let win: BrowserWindow | null = null;
  let readyPromise: Promise<void> | null = null;

  // One process-wide listener; filters on the live window's sender so a
  // stale window's late messages (or any other renderer) can't inject.
  ipcMain.on(UP_CHANNEL, (event, message: unknown) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    onUp(message);
  });

  const dropWindow = (): void => {
    win = null;
    readyPromise = null;
  };

  const spawn = (): Promise<void> => {
    const created = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(__dirname, '..', 'preload', 'sandbox.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    attachWindowSecurity(created);
    win = created;

    const ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      const readyListener = (event: Electron.IpcMainEvent, message: unknown): void => {
        if (event.sender !== created.webContents) return;
        const data = message as { type?: unknown } | null;
        if (!data || data.type !== 'sandbox.ready') return;
        settled = true;
        ipcMain.removeListener(UP_CHANNEL, readyListener);
        resolve();
      };
      ipcMain.on(UP_CHANNEL, readyListener);
      created.webContents.once('did-fail-load', (_e, code, description) => {
        if (settled) return;
        settled = true;
        ipcMain.removeListener(UP_CHANNEL, readyListener);
        reject(new Error(`sandbox page failed to load (${code}: ${description})`));
      });
    });

    created.webContents.on('render-process-gone', (_event, details) => {
      logger.warn('sandbox renderer gone — respawning on next run', { reason: details.reason });
      if (!created.isDestroyed()) created.destroy();
      dropWindow();
    });
    created.on('closed', dropWindow);

    const devUrl = process.env.ELECTRON_RENDERER_URL;
    const load = devUrl
      ? created.loadURL(`${devUrl}/sandbox.html`)
      : created.loadFile(join(__dirname, '..', 'renderer', 'sandbox.html'));

    return Promise.all([load, ready]).then(() => {
      logger.info('sandbox window ready');
    });
  };

  return {
    ensureReady(): Promise<void> {
      if (win && !win.isDestroyed() && readyPromise) return readyPromise;
      readyPromise = spawn().catch((err: unknown) => {
        // A failed spawn must not poison every later run.
        if (win && !win.isDestroyed()) win.destroy();
        dropWindow();
        throw err;
      });
      return readyPromise;
    },
    post(message: unknown): void {
      if (!win || win.isDestroyed()) return;
      win.webContents.send(DOWN_CHANNEL, message);
    },
    close(reason: 'idle' | 'shutdown'): void {
      if (win && !win.isDestroyed()) {
        win.destroy();
        logger.info(`sandbox window closed (${reason})`);
      }
      dropWindow();
    },
  };
}
