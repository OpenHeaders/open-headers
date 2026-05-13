/**
 * Desktop app — rewrite in progress.
 *
 * The previous main-process tree was removed for a from-scratch rebuild
 * aligned with the new shared UI. This file exists so electron-vite +
 * `pnpm turbo typecheck`/`build` keep working in CI; it intentionally
 * does not wire any production features.
 */

import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';

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

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
