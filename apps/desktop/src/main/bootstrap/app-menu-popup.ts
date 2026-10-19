/**
 * Main-side handler for the renderer's in-window menu button. Windows
 * and Linux windows are frameless (`titleBarStyle: 'hidden'`), which
 * hides the native menu bar the application menu would otherwise
 * live in — so the top bar carries a button that pops the SAME
 * application menu as a native context menu, anchored under it. macOS
 * keeps the system menu bar and never registers the capability.
 *
 * The anchor arrives in the renderer's CSS pixels; `Menu.popup` wants
 * DIP relative to the window's web content, so the sender's zoom
 * factor is applied here.
 */

import { BrowserWindow, ipcMain, Menu } from 'electron';

const CHANNEL = 'oh:app-menu:popup';

export interface AppMenuAnchor {
  x: number;
  y: number;
}

export function popupApplicationMenu(sender: Electron.WebContents, anchor: AppMenuAnchor): void {
  const menu = Menu.getApplicationMenu();
  const window = BrowserWindow.fromWebContents(sender);
  if (!menu || !window) return;
  const zoom = sender.getZoomFactor();
  menu.popup({ window, x: Math.round(anchor.x * zoom), y: Math.round(anchor.y * zoom) });
}

export function installAppMenuPopupHandler(): void {
  ipcMain.handle(CHANNEL, (event, anchor: AppMenuAnchor) => {
    popupApplicationMenu(event.sender, anchor);
  });
}
