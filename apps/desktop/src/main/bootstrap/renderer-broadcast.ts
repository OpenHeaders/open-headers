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
