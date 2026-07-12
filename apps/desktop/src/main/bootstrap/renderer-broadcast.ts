/**
 * Fan a bridge broadcast out to every open renderer. Single-window
 * desktop today; safe-by-construction for multi-window down the line.
 * Shared by the engine shell (`install-rpc-host`) and the native-chrome
 * modules (application menu, tray) so both sides speak the same
 * `oh:broadcast` envelope.
 */

import { BrowserWindow } from 'electron';

const BROADCAST_CHANNEL = 'oh:broadcast';

export function broadcastToAllRenderers(type: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send(BROADCAST_CHANNEL, { type, payload });
    } catch {
      // Renderer probably navigated away mid-send — broadcast is
      // best-effort. Swallow.
    }
  }
}

/**
 * Send a bridge broadcast to the focused window only — for menu items
 * whose action targets "the window the user is looking at" (tab
 * navigation), where fanning out to every window would move tabs the
 * user can't see. No focused window → no-op (menus that reach this
 * state are macOS's while all windows are hidden).
 */
export function sendToFocusedRenderer(type: string, payload: unknown): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) sendToRendererWindow(win, type, payload);
}

/** Send a bridge broadcast to one specific window. */
export function sendToRendererWindow(win: BrowserWindow, type: string, payload: unknown): void {
  if (win.isDestroyed()) return;
  try {
    win.webContents.send(BROADCAST_CHANNEL, { type, payload });
  } catch {
    // Same best-effort semantics as the fan-out above.
  }
}
