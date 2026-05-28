/**
 * Application menu — the macOS menu-bar / Windows + Linux window menu.
 *
 * Without an explicit menu, Electron supplies a default that says
 * "Electron" instead of "Open Headers" and is missing role-bound
 * shortcuts (`Cmd+Q`, `Cmd+W`, the Edit / Window / Help groups).
 *
 * Future slices will add Settings + Check for Updates menu items as
 * those features land; for now the menu carries only what already
 * works in v5.
 */

import { app, Menu, type MenuItemConstructorOptions, shell } from 'electron';

const HOMEPAGE_URL = 'https://openheaders.io';
const ISSUES_URL = 'https://github.com/OpenHeaders/open-headers-app/issues/new';

function template(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  const macAppMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.getName(),
          submenu: [
            { label: `About ${app.getName()}`, click: () => app.showAboutPanel() },
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
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
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
      ],
    },
  ];
}

export function installApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template()));
}
