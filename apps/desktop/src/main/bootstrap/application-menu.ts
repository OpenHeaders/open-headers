/**
 * Application menu — the macOS menu-bar / Windows + Linux window menu.
 *
 * Without an explicit menu, Electron supplies a default that says
 * "Electron" instead of "Open Headers" and is missing role-bound
 * shortcuts (`Cmd+Q`, `Cmd+W`, the Edit / Window / Help groups).
 *
 * Update + Settings affordances follow the platform convention:
 *   - macOS: both live in the app menu (About → Check for Updates… →
 *     Settings…), the JetBrains/system layout.
 *   - Windows / Linux: Settings… under File, Check for Updates… under
 *     Help.
 * The update item is state-driven — the menu registers with
 * `update-menus` and rebuilds on every updater transition.
 */

import { app, Menu, type MenuItemConstructorOptions, nativeImage, shell } from 'electron';
import { broadcastToAllRenderers } from './renderer-broadcast';
import { registerUpdateMenuBuilder, updateMenuItems } from './update-menus';
import { createChildWindow, showMainWindow } from './window-manager';

const HOMEPAGE_URL = 'https://openheaders.io';
const ISSUES_URL = 'https://github.com/OpenHeaders/open-headers-releases/issues/new';

function openSettingsSurface(): void {
  // The tray-resident window is hidden, not destroyed, so the renderer
  // is mounted and its `openSettings` subscription is live by the time
  // the broadcast lands.
  showMainWindow();
  broadcastToAllRenderers('openSettings', {});
}

// The standard macOS gear glyph as a template image so the menu recolors
// it for light/dark; named system images don't exist on Windows / Linux,
// where native menus stay text-only anyway.
function settingsGearIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromNamedImage('NSActionTemplate').resize({ width: 16, height: 16 });
  icon.setTemplateImage(true);
  return icon;
}

function settingsMenuItem(): MenuItemConstructorOptions {
  return {
    label: 'Settings…',
    accelerator: 'CommandOrControl+,',
    ...(process.platform === 'darwin' ? { icon: settingsGearIcon() } : {}),
    click: openSettingsSurface,
  };
}

function template(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';
  const updateItems = updateMenuItems();

  const macAppMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.getName(),
          submenu: [
            { label: `About ${app.getName()}`, click: () => app.showAboutPanel() },
            ...updateItems,
            { type: 'separator' },
            settingsMenuItem(),
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ]
    : [];

  return [
    ...macAppMenu,
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CommandOrControl+Shift+N',
          click: () => {
            createChildWindow();
          },
        },
        ...(!isMac ? ([{ type: 'separator' }, settingsMenuItem()] as MenuItemConstructorOptions[]) : []),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(!app.isPackaged
          ? ([
              { type: 'separator' },
              { role: 'toggleDevTools' },
              { role: 'reload' },
              { role: 'forceReload' },
            ] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => void shell.openExternal(HOMEPAGE_URL) },
        { label: 'Report an Issue', click: () => void shell.openExternal(ISSUES_URL) },
        ...(!isMac && updateItems.length > 0
          ? ([{ type: 'separator' }, ...updateItems] as MenuItemConstructorOptions[])
          : []),
      ],
    },
  ];
}

export function installApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template()));
  registerUpdateMenuBuilder(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template()));
  });
}
