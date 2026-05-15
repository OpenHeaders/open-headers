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
  // Hide the native title bar so the renderer's own top toolbar
  // (OH logo + workspace selector + env picker + layout buttons) is
  // the only chrome row — matches Postman / VS Code / Slack desktop.
  //
  //   - macOS: `hiddenInset` keeps the traffic lights but drops the
  //     "Open Headers" title strip; `trafficLightPosition` aligns them
  //     vertically with the toolbar items. The renderer reserves
  //     ~78px on the left of its toolbar so the OH logo doesn't sit
  //     under the lights.
  //   - Windows / Linux: `titleBarOverlay` paints the min/max/close
  //     controls onto a flush area; renderer reserves room on the
  //     right via the same approach.
  const platformChrome =
    process.platform === 'darwin'
      ? ({
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 },
        })
      : ({
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#1d1d1f',
            height: 40,
          },
        });

  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    show: false,
    ...platformChrome,
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
