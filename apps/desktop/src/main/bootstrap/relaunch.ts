/**
 * In-app relaunch — the shared `app.relaunch()` + `app.quit()` sequence
 * for features whose change only applies on the next boot (hardware
 * acceleration, a fresh OS-keychain prompt for secrets storage).
 *
 * Two invariants every caller needs and none should re-derive:
 *
 *   - Tray-resident hidden window: keep the relaunch silent instead of
 *     flashing the window visible (same contract as the updater's
 *     quitAndInstall path).
 *   - The primary window intercepts 'close' into a hide unless the
 *     quitting flag is up — without `markQuitting` the quit never
 *     completes and the relaunch silently degrades into a window hide.
 */

import { app } from 'electron';
import { writeRestartHiddenFlag } from './launch-flags';
import { markQuitting } from './quit-state';
import { getMainWindow } from './window-manager';

export function relaunchApp(): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed() && !win.isVisible()) writeRestartHiddenFlag();
  markQuitting();
  app.relaunch();
  app.quit();
}
