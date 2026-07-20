/**
 * In-app relaunch — the shared restart sequence for features whose
 * change only applies on the next boot (hardware acceleration, a fresh
 * OS-keychain prompt for secrets storage).
 *
 * Two invariants every caller needs and none should re-derive:
 *
 *   - Tray-resident hidden window: keep the relaunch silent instead of
 *     flashing the window visible (same contract as the updater's
 *     install path). The visibility check must run NOW — the lifecycle
 *     teardown destroys windows before the finisher fires.
 *   - The quit itself goes through the lifecycle machine, so the
 *     engine flush and pty drain complete before the process restarts.
 */

import { app } from 'electron';
import { writeRestartHiddenFlag } from './launch-flags';
import { requestQuit } from './lifecycle';
import { getMainWindow } from './window-manager';

export function relaunchApp(): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed() && !win.isVisible()) writeRestartHiddenFlag();
  requestQuit({
    reason: 'relaunch',
    finish: () => {
      app.relaunch();
      app.quit();
    },
  });
}
