/**
 * Window position + size persistence across launches. State lives in
 * `<userData>/state/window-state.json` (outside the engine's HostStorage
 * so it's available before engine boot) and is re-read at window creation
 * time. Writes are debounced because move / resize fire continuously
 * during a drag.
 *
 * Validation guards two failure modes:
 *   - Stored bounds reference a display that no longer exists
 *     (laptop unplugged from external monitor). Without the check the
 *     window appears off-screen and is unreachable.
 *   - Stored bounds are below the workbench's minimums. Restoring a
 *     hand-edited 200×100 window would break layout.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserWindow, type Rectangle, screen } from 'electron';
import { stateDir } from './app-paths';
import { createLogger } from './logger';

const logger = createLogger('window-state');

const STATE_FILENAME = 'window-state.json';
const SAVE_DEBOUNCE_MS = 250;

export type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
  fullscreen: boolean;
};

function statePath(): string {
  return join(stateDir(), STATE_FILENAME);
}

function rectanglesIntersect(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function boundsWithinAnyDisplay(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) return true;
  const rect = { x: state.x, y: state.y, width: state.width, height: state.height };
  return screen.getAllDisplays().some((display) => rectanglesIntersect(rect, display.workArea));
}

export function loadWindowState(minWidth: number, minHeight: number): WindowState | null {
  try {
    const path = statePath();
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<WindowState>;
    if (typeof raw.width !== 'number' || typeof raw.height !== 'number') return null;
    if (raw.width < minWidth || raw.height < minHeight) return null;
    const state: WindowState = {
      x: typeof raw.x === 'number' ? raw.x : undefined,
      y: typeof raw.y === 'number' ? raw.y : undefined,
      width: raw.width,
      height: raw.height,
      maximized: raw.maximized === true,
      fullscreen: raw.fullscreen === true,
    };
    if (!boundsWithinAnyDisplay(state)) return null;
    return state;
  } catch (err) {
    logger.warn('failed to load', err);
    return null;
  }
}

function writeStateSync(state: WindowState): void {
  try {
    writeFileSync(statePath(), JSON.stringify(state));
  } catch (err) {
    logger.warn('failed to write', err);
  }
}

export function attachWindowStateTracking(win: BrowserWindow): void {
  let pending: NodeJS.Timeout | null = null;

  const capture = (): void => {
    if (win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    const isFullscreen = win.isFullScreen();
    // `getNormalBounds` returns the un-maximized rect so a window that
    // was maximized last session restores to its previous floating size
    // on unmaximize.
    const bounds = win.getNormalBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: isMaximized,
      fullscreen: isFullscreen,
    };
    writeStateSync(state);
  };

  const schedule = (): void => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(capture, SAVE_DEBOUNCE_MS);
  };

  win.on('move', schedule);
  win.on('resize', schedule);
  win.on('maximize', schedule);
  win.on('unmaximize', schedule);
  win.on('enter-full-screen', schedule);
  win.on('leave-full-screen', schedule);
  // Flush any pending save synchronously on close — the timer would
  // otherwise be cancelled before it fires.
  win.on('close', () => {
    if (pending) {
      clearTimeout(pending);
      pending = null;
    }
    capture();
  });
}
