/**
 * Tray-resident primary window. Created once, hidden on close, never
 * destroyed — so subsequent opens are `win.show()` on an already-mounted,
 * already-hydrated window.
 */

import { join } from 'node:path';
import { app, BrowserWindow, screen } from 'electron';
import { shouldLaunchHidden } from './launch-flags';
import { attachRendererDiagnostics } from './process-diagnostics';
import { markRendererReadyAndDrain, resetRendererReady } from './protocol';
import { isQuitting } from './quit-state';
import { attachWindowSecurity } from './security';
import { attachWindowStateTracking, loadWindowState } from './window-state';

const DEFAULT_WINDOW_FRACTION = 0.8;
const MIN_WIDTH = 880;
const MIN_HEIGHT = 600;

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  // Hide the native title bar so the renderer's own top toolbar is the
  // only chrome row. macOS keeps the traffic lights via `hiddenInset`;
  // Windows / Linux get a flush `titleBarOverlay` with min/max/close.
  const platformChrome =
    process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 },
        }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#1d1d1f',
            height: 40,
          },
        };

  // Restore the previous window placement when valid; otherwise default
  // to 80% of the primary display's work area, centered.
  const restored = loadWindowState(MIN_WIDTH, MIN_HEIGHT);
  const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;
  const defaultWidth = Math.max(MIN_WIDTH, Math.floor(workW * DEFAULT_WINDOW_FRACTION));
  const defaultHeight = Math.max(MIN_HEIGHT, Math.floor(workH * DEFAULT_WINDOW_FRACTION));

  const win = new BrowserWindow({
    x: restored?.x,
    y: restored?.y,
    width: restored?.width ?? defaultWidth,
    height: restored?.height ?? defaultHeight,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    center: restored?.x === undefined,
    show: false,
    ...platformChrome,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (restored?.maximized) win.maximize();
  if (restored?.fullscreen) win.setFullScreen(true);

  attachWindowSecurity(win);
  attachWindowStateTracking(win);
  attachRendererDiagnostics(win);

  // Renderer is ready to receive `oh:protocol:url` once its load
  // completes (preload's `ipcRenderer.on` is wired before this fires).
  // Dev hot-reload re-fires this — `markRendererReadyAndDrain` is
  // idempotent and re-flushes anything queued during the reload.
  win.webContents.on('did-finish-load', markRendererReadyAndDrain);
  win.webContents.on('destroyed', resetRendererReady);

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Hide-on-launch: skip the auto-show. Window stays invisible (but
  // mounted and hydrating in the background) until something — tray
  // click, dock click, deep link — calls `showMainWindow()`.
  if (!shouldLaunchHidden()) {
    win.once('ready-to-show', () => win.show());
  }

  // Close intercept: hide instead of destroy. Real quit comes through
  // `before-quit` (which sets `isQuitting`), the tray Quit menu, or
  // `Cmd+Q`.
  win.on('close', (event) => {
    if (isQuitting()) return;
    event.preventDefault();
    win.hide();
  });

  mainWindow = win;
  return win;
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Resolve a path inside `apps/desktop/build/` for both dev and packaged
 * runs. `extraResources` in `package.json` copies `build/*.png` to the
 * root of `process.resourcesPath` at pack time.
 */
export function buildAssetPath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, name)
    : join(__dirname, '..', '..', 'build', name);
}
