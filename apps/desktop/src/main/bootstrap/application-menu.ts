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

import type { Translator } from '@openheaders/i18n';
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions, nativeImage, shell } from 'electron';
import { isHardwareAccelerationDisabled, toggleHardwareAcceleration } from './hardware-acceleration';
import { mainTranslator } from './locale';
import { broadcastToAllRenderers, sendToFocusedRenderer, sendToRendererWindow } from './renderer-broadcast';
import { registerUpdateMenuBuilder, updateMenuItems } from './update-menus';
import { createChildWindow, getMainWindow, showMainWindow } from './window-manager';

const HOMEPAGE_URL = 'https://openheaders.com';
const ISSUES_URL = 'https://github.com/OpenHeaders/open-headers/issues/new';
const EULA_URL = 'https://openheaders.com/eula';

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

function settingsMenuItem(t: Translator): MenuItemConstructorOptions {
  return {
    label: t('desktop.menu.settings'),
    accelerator: 'CommandOrControl+,',
    ...(process.platform === 'darwin' ? { icon: settingsGearIcon() } : {}),
    click: openSettingsSurface,
  };
}

function hardwareAccelerationMenuItem(t: Translator): MenuItemConstructorOptions {
  return {
    label: isHardwareAccelerationDisabled()
      ? t('desktop.menu.enableHardwareAcceleration')
      : t('desktop.menu.disableHardwareAcceleration'),
    click: () => {
      void toggleHardwareAcceleration().then(rebuildApplicationMenu);
    },
  };
}

// Create / import commands land in the focused window; with every
// window hidden (tray-resident state — the macOS menu bar stays
// reachable) they reveal the primary window first and land there. The
// tray-resident renderer is mounted while hidden, so its subscription
// is live before the send.
function sendMenuCommand(command: 'newItem' | 'newTab' | 'import'): void {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    sendToRendererWindow(focused, 'menuCommand', { command });
    return;
  }
  showMainWindow();
  const main = getMainWindow();
  if (main) sendToRendererWindow(main, 'menuCommand', { command });
}

// Close Tab targets the focused window only — no reveal: closing a tab
// in a window the user can't see would be silent data-flow. The
// renderer applies its normal dirty-confirm flow.
function closeTabMenuItem(t: Translator): MenuItemConstructorOptions {
  return {
    label: t('desktop.menu.closeTab'),
    accelerator: 'CommandOrControl+W',
    click: () => sendToFocusedRenderer('menuCommand', { command: 'closeTab' }),
  };
}

// Editor-tab cycling in the focused window. Bracket chords on macOS
// (⇧⌘] / ⇧⌘[); the classic Ctrl+Tab pair on Windows / Linux, where
// bracket chords collide with keyboard-layout AltGr sequences. These are
// native accelerators, so they work regardless of the renderer's own
// rebindable Alt+] / Alt+[ bindings.
function tabNavigationMenuItems(isMac: boolean, t: Translator): MenuItemConstructorOptions[] {
  return [
    {
      label: t('desktop.menu.nextTab'),
      accelerator: isMac ? 'Shift+Command+]' : 'Control+Tab',
      click: () => sendToFocusedRenderer('tabNavigate', { direction: 'next' }),
    },
    {
      label: t('desktop.menu.previousTab'),
      accelerator: isMac ? 'Shift+Command+[' : 'Control+Shift+Tab',
      click: () => sendToFocusedRenderer('tabNavigate', { direction: 'previous' }),
    },
  ];
}

function template(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';
  const t = mainTranslator();
  const updateItems = updateMenuItems();

  const macAppMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.getName(),
          submenu: [
            { label: t('desktop.menu.about', { name: app.getName() }), click: () => app.showAboutPanel() },
            ...updateItems,
            { type: 'separator' },
            hardwareAccelerationMenuItem(t),
            { type: 'separator' },
            settingsMenuItem(t),
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
      label: t('desktop.menu.file'),
      submenu: [
        {
          label: t('desktop.menu.newItem'),
          accelerator: 'CommandOrControl+N',
          click: () => sendMenuCommand('newItem'),
        },
        {
          label: t('desktop.menu.newTab'),
          accelerator: 'CommandOrControl+T',
          click: () => sendMenuCommand('newTab'),
        },
        {
          label: t('desktop.menu.newWindow'),
          accelerator: 'CommandOrControl+Shift+N',
          click: () => {
            createChildWindow();
          },
        },
        { type: 'separator' },
        {
          label: t('desktop.menu.import'),
          accelerator: 'CommandOrControl+O',
          click: () => sendMenuCommand('import'),
        },
        ...(!isMac
          ? ([
              { type: 'separator' },
              settingsMenuItem(t),
              hardwareAccelerationMenuItem(t),
            ] as MenuItemConstructorOptions[])
          : []),
        { type: 'separator' },
        // Close Window moves to ⇧⌘W so the plain chord goes to Close
        // Tab — the native-app convention.
        ...(isMac
          ? ([{ role: 'close', accelerator: 'Shift+Command+W' }, closeTabMenuItem(t)] as MenuItemConstructorOptions[])
          : ([closeTabMenuItem(t), { role: 'quit' }] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: t('desktop.menu.edit'),
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
      label: t('desktop.menu.view'),
      submenu: [
        { role: 'resetZoom', label: t('desktop.menu.actualSize') },
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
      label: t('desktop.menu.window'),
      ...(isMac ? { role: 'window' as const } : {}),
      submenu: [
        { role: 'minimize' },
        ...(isMac ? ([{ role: 'zoom' }] as MenuItemConstructorOptions[]) : []),
        { type: 'separator' },
        ...tabNavigationMenuItems(isMac, t),
        ...(isMac
          ? ([{ type: 'separator' }, { role: 'front' }] as MenuItemConstructorOptions[])
          : // ⇧Ctrl+W, not the role's default Ctrl+W — the plain chord
            // belongs to File > Close Tab.
            ([
              { type: 'separator' },
              { role: 'close', accelerator: 'Shift+Control+W' },
            ] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: t('desktop.menu.help'),
      submenu: [
        { label: t('desktop.menu.documentation'), click: () => void shell.openExternal(HOMEPAGE_URL) },
        { label: t('desktop.menu.reportIssue'), click: () => void shell.openExternal(ISSUES_URL) },
        { label: t('desktop.menu.licenseAgreement'), click: () => void shell.openExternal(EULA_URL) },
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
