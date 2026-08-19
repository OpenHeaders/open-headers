/**
 * Native About panel — `app.showAboutPanel()` reads these options on
 * macOS and Linux. Wired by the macOS app menu's "About Open Headers"
 * item in `application-menu.ts`.
 *
 * Without `setAboutPanelOptions`, macOS falls back to the bundle's
 * `Info.plist` (which carries the electron-builder defaults) and Linux
 * shows an empty placeholder.
 */

import { app } from 'electron';
import { buildAssetPath } from './window-manager';

export function installAboutPanel(): void {
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} Bithub Team SRL`,
    website: 'https://openheaders.com',
    iconPath: buildAssetPath('icon128.png'),
  });
}
