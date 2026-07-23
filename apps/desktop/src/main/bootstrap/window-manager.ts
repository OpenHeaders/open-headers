/**
 * Tray-resident primary window. Created once, hidden on close, never
 * destroyed — so subsequent opens are `win.show()` on an already-mounted,
 * already-hydrated window.
 */

import { join } from 'node:path';
import { app, BrowserWindow, nativeTheme, screen } from 'electron';
import { shouldLaunchHidden } from './launch-flags';
import { isQuitting } from './lifecycle';
import { createLogger } from './logger';
import { attachRendererDiagnostics } from './process-diagnostics';
import { markRendererReadyAndDrain, resetRendererReady } from './protocol';
import { sendToRendererWindow } from './renderer-broadcast';
import { attachWindowSecurity } from './security';
import { attachWindowStateTracking, loadWindowState } from './window-state';
import { forceForegroundWindow } from './windows-foreground';

// Per-dimension fraction of the work area for the first-run window.
// Sizing intent is in SCREEN AREA: 0.95 × 0.95 ≈ 90% of the screen —
// a per-dimension 0.8 reads as a much smaller ~64%-of-screen window.
const DEFAULT_WINDOW_FRACTION = 0.95;
const MIN_WIDTH = 880;
const MIN_HEIGHT = 600;

const logger = createLogger('startup');

/**
 * The frame paints this before the renderer's first frame lands, so it
 * must match the boot shell's palette in `index.html` (same
 * `nativeTheme` signal the startup-data bridge serves) — a mismatch
 * reads as a background flash the moment the shell paints.
 */
function frameBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff';
}

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
    backgroundColor: frameBackgroundColor(),
    ...platformChrome,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Chromium's built-in PDF viewer is a plugin (default OFF in
      // Electron) — the response panel's blob PDF preview iframe stays
      // blank without it.
      plugins: true,
    },
  });
  logger.info(`main window created (+${process.uptime().toFixed(2)}s)`);

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

  // Startup milestones — the two renderer-side marks the log was blind
  // to: first paintable frame and load completion. One-shot listeners;
  // steady-state reloads don't spam the log.
  win.once('ready-to-show', () => {
    logger.info(`renderer first frame ready (+${process.uptime().toFixed(2)}s)`);
  });
  win.webContents.once('did-finish-load', () => {
    logger.info(`renderer loaded (+${process.uptime().toFixed(2)}s)`);
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Hide-on-launch: skip the auto-show. Window stays invisible (but
  // mounted and hydrating in the background) until something — tray
  // click, dock click, deep link — calls `showMainWindow()`.
  //
  // Visible launches show NOW, not on `ready-to-show`: the frame
  // paints `backgroundColor` immediately and the renderer fills it in,
  // so launch feedback is instant instead of a multi-second silent gap
  // on a cold first run. Showing immediately also matters for the
  // post-install launch — the NSIS installer spawns this process, and
  // by the time a `ready-to-show`-gated window appeared, Windows'
  // foreground grant had lapsed and the window degraded to a taskbar
  // attention flash the user had to click. The native foreground
  // helper re-arms that grant (mocked keystroke +
  // AllowSetForegroundWindow) so the window actually fronts; it no-ops
  // off Windows.
  if (!shouldLaunchHidden()) {
    win.show();
    if (process.platform === 'win32') forceForegroundWindow(process.pid);
  }

  // Close intercept: hide instead of destroy. Real quit goes through
  // the lifecycle machine (tray Quit menu, `Cmd+Q`), which flips
  // `isQuitting` and destroys windows itself.
  win.on('close', (event) => {
    if (isQuitting()) return;
    event.preventDefault();
    win.hide();
    // The renderer outlives this hide — tell it the app "closed" so
    // session-scoped state (recently-closed terminal tabs) resets.
    sendToRendererWindow(win, 'windowHiddenToTray', {});
  });

  mainWindow = win;
  return win;
}

export function showMainWindow(): void {
  // Mid-teardown (dock 'activate' racing a quit): never recreate or
  // reveal a window the lifecycle machine is tearing down.
  if (isQuitting()) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Open an additional window. Unlike the tray-resident primary, child
 * windows are destroyable on close, skip the launch-hidden gate, and
 * don't participate in window-state persistence (their bounds reset on
 * each open — a richer per-window persistence story can land later).
 *
 * They share the same React bundle and preload, so all the existing
 * mirror / RPC machinery works without changes. macOS lists each
 * window in the application Window menu automatically by title.
 *
 * Deep-link drain stays attached to the primary window only — secondary
 * windows are intentionally outside the `openheaders://` target until
 * we have a routing story.
 */
export function createChildWindow(): BrowserWindow {
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

  const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.max(MIN_WIDTH, Math.floor(workW * DEFAULT_WINDOW_FRACTION));
  const height = Math.max(MIN_HEIGHT, Math.floor(workH * DEFAULT_WINDOW_FRACTION));

  const win = new BrowserWindow({
    width,
    height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: app.getName(),
    show: false,
    backgroundColor: frameBackgroundColor(),
    ...platformChrome,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Same PDF-viewer plugin allowance as the main window — this
      // window hosts the identical workbench renderer.
      plugins: true,
    },
  });

  attachWindowSecurity(win);
  attachRendererDiagnostics(win);

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  win.once('ready-to-show', () => {
    if (!isQuitting()) win.show();
  });
  return win;
}

/**
 * Resolve a path inside `apps/desktop/build/` for both dev and packaged
 * runs. `extraResources` in `package.json` copies `build/*.png` to the
 * root of `process.resourcesPath` at pack time.
 */
export function buildAssetPath(name: string): string {
  return app.isPackaged ? join(process.resourcesPath, name) : join(__dirname, '..', '..', 'build', name);
}
