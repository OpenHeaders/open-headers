/**
 * Menu-bar / system-tray icon. Owns the only "Quit" affordance for the
 * tray-resident lifecycle; closing the window hides it, only the tray
 * Quit (or `Cmd+Q`) actually exits the process.
 */

import { app, Menu, nativeImage, Tray } from 'electron';
import { markQuitting } from './quit-state';
import { buildAssetPath, showMainWindow } from './window-manager';

// Module-scoped to keep the Tray alive — GC'd Trays disappear from the
// menu bar.
let tray: Tray | null = null;

export function installTray(): Tray {
  // macOS uses a monochrome template icon that the OS recolors for
  // light/dark menu bars. Windows / Linux get a colored 32px icon.
  const iconPath = buildAssetPath(process.platform === 'darwin' ? 'iconTemplate.png' : 'icon32.png');
  const image = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') image.setTemplateImage(true);

  const t = new Tray(image);
  t.setToolTip('Open Headers');

  const menu = Menu.buildFromTemplate([
    { label: 'Open Open Headers', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        markQuitting();
        app.quit();
      },
    },
  ]);
  t.setContextMenu(menu);

  // Left-click behavior: on macOS the context menu opens by default;
  // on Windows / Linux a left-click should show the window.
  t.on('click', () => {
    if (process.platform !== 'darwin') showMainWindow();
  });

  tray = t;
  return t;
}

export function getTray(): Tray | null {
  return tray;
}
