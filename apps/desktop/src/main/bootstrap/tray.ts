/**
 * Menu-bar / system-tray icon. Owns the only "Quit" affordance for the
 * tray-resident lifecycle; closing the window hides it, only the tray
 * Quit (or `Cmd+Q`) actually exits the process.
 *
 * The update item between "Open" and "Quit" is state-driven — the tray
 * registers with `update-menus` and rebuilds its context menu on every
 * updater transition, so a background download's progress is visible
 * without any window open.
 */

import { Menu, nativeImage, Tray } from 'electron';
import { openSettingsSurface } from './application-menu';
import { requestQuit } from './lifecycle';
import { mainTranslator } from './locale';
import { createLogger } from './logger';
import { registerUpdateMenuBuilder, updateMenuItems } from './update-menus';
import { buildAssetPath, showMainWindow } from './window-manager';

// Module-scoped to keep the Tray alive — GC'd Trays disappear from the
// menu bar.
let tray: Tray | null = null;

function buildTrayMenu(): Menu {
  const t = mainTranslator();
  const updateItems = updateMenuItems();
  return Menu.buildFromTemplate([
    { label: t('desktop.tray.open'), click: showMainWindow },
    ...(updateItems.length > 0 ? [{ type: 'separator' as const }, ...updateItems] : []),
    { type: 'separator' },
    { label: t('desktop.menu.settings'), click: openSettingsSurface },
    {
      label: t('desktop.tray.quit'),
      click: () => requestQuit({ reason: 'tray-quit' }),
    },
  ]);
}

export function installTray(): Tray {
  // macOS uses a monochrome template icon that the OS recolors for
  // light/dark menu bars. Windows / Linux get a colored 32px icon.
  const iconPath = buildAssetPath(process.platform === 'darwin' ? 'iconTemplate.png' : 'icon32.png');
  const image = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') image.setTemplateImage(true);

  const t = new Tray(image);
  t.setToolTip('Open Headers');
  t.setContextMenu(buildTrayMenu());
  registerUpdateMenuBuilder(() => {
    tray?.setContextMenu(buildTrayMenu());
  });

  // Left-click behavior: on macOS the context menu opens by default;
  // on Windows / Linux a left-click should show the window.
  t.on('click', () => {
    if (process.platform !== 'darwin') showMainWindow();
  });

  tray = t;
  createLogger('startup').info(`tray installed (+${process.uptime().toFixed(2)}s)`);
  return t;
}

export function getTray(): Tray | null {
  return tray;
}
