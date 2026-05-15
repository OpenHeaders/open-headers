/**
 * Desktop app — main-process entry point. Boots the oracle engine host
 * (workspace bootstrap → hydrate → sync engine → bridges → coord runner)
 * via `installRpcHost`, then opens the renderer window. The renderer
 * talks to the engine over the `oh:rpc` IPC channel exposed by the
 * preload script.
 */

import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';
import { installRpcHost } from './main/install-rpc-host';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void win.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
}

void app.whenReady().then(async () => {
  // Engine host must be ready before the first IPC RPC fires. The
  // renderer's mount blocks on RPCs (`oh.sync.snapshot*` for the
  // initial mirror seed), so booting after window-open would race the
  // first RPC against the dispatcher registration.
  try {
    await installRpcHost();
  } catch (err) {
    console.error('Desktop main: installRpcHost failed', err);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
