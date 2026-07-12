/**
 * Application menu — the macOS menu-bar / Windows + Linux window menu.
 *
 * Without an explicit menu, Electron supplies a default that says
 * "Electron" instead of "Open Headers" and is missing role-bound
 * shortcuts (`Cmd+Q`, `Cmd+W`, the Edit / Window / Help groups).
 *
 * Update + Settings affordances follow the platform convention:
 *   - macOS: both live in the app menu (About → Check for Updates… →
 *     Settings…), the standard system layout.
 *   - Windows / Linux: Settings… under File, Check for Updates… under
 *     Help.
 * The update item is state-driven — the menu registers with
 * `update-menus` and rebuilds on every updater transition.
 */

import { app, Menu, type MenuItemConstructorOptions, nativeImage, shell } from 'electron';
import { isHardwareAccelerationDisabled, toggleHardwareAcceleration } from './hardware-acceleration';
import { broadcastToAllRenderers, sendToFocusedRenderer } from './renderer-broadcast';
import { registerUpdateMenuBuilder, updateMenuItems } from './update-menus';
import { createChildWindow, showMainWindow } from './window-manager';

const HOMEPAGE_URL = 'https://openheaders.io';
const ISSUES_URL = 'https://github.com/OpenHeaders/open-headers-releases/issues/new';
const EULA_URL = 'https://openheaders.io/eula';

export function openSettingsSurface(): void {
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

function hardwareAccelerationMenuItem(): MenuItemConstructorOptions {
  return {
    label: isHardwareAccelerationDisabled() ? 'Enable Hardware Acceleration' : 'Disable Hardware Acceleration',
    click: () => {
      void toggleHardwareAcceleration().then(rebuildApplicationMenu);
    },
  };
}

// Editor-tab cycling in the focused window. Postman-convention chords on
// macOS (⇧⌘] / ⇧⌘[); the classic Ctrl+Tab pair on Windows / Linux, where
// bracket chords collide with keyboard-layout AltGr sequences. These are
// native accelerators, so they work regardless of the renderer's own
// rebindable Alt+] / Alt+[ bindings.
function tabNavigationMenuItems(isMac: boolean): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Next Tab',
      accelerator: isMac ? 'Shift+Command+]' : 'Control+Tab',
      click: () => sendToFocusedRenderer('tabNavigate', { direction: 'next' }),
    },
    {
      label: 'Previous Tab',
      accelerator: isMac ? 'Shift+Command+[' : 'Control+Shift+Tab',
      click: () => sendToFocusedRenderer('tabNavigate', { direction: 'previous' }),
    },
  ];
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
            hardwareAccelerationMenuItem(),
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
        ...(!isMac
          ? ([
              { type: 'separator' },
              settingsMenuItem(),
              hardwareAccelerationMenuItem(),
            ] as MenuItemConstructorOptions[])
          : []),
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
    // Explicit Window menu instead of `role: 'windowMenu'` — the role's
    // fixed submenu can't be extended with the tab-navigation items.
    // Role-bound entries reproduce what the role provided; macOS still
    // appends the open-window list automatically via `role: 'window'`
    // on the top-level item.
    {
      label: 'Window',
      ...(isMac ? { role: 'window' as const } : {}),
      submenu: [
        { role: 'minimize' },
        ...(isMac ? ([{ role: 'zoom' }] as MenuItemConstructorOptions[]) : []),
        { type: 'separator' },
        ...tabNavigationMenuItems(isMac),
        ...(isMac
          ? ([{ type: 'separator' }, { role: 'front' }] as MenuItemConstructorOptions[])
          : ([{ type: 'separator' }, { role: 'close' }] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => void shell.openExternal(HOMEPAGE_URL) },
        { label: 'Report an Issue', click: () => void shell.openExternal(ISSUES_URL) },
        { label: 'License Agreement', click: () => void shell.openExternal(EULA_URL) },
        ...(!isMac && updateItems.length > 0
          ? ([{ type: 'separator' }, ...updateItems] as MenuItemConstructorOptions[])
          : []),
      ],
    },
  ];
}

function rebuildApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template()));
}

export function installApplicationMenu(): void {
  rebuildApplicationMenu();
  registerUpdateMenuBuilder(rebuildApplicationMenu);
}
