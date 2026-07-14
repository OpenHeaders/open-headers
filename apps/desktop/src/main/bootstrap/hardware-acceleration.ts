/**
 * Hardware-acceleration policy — the app-menu "Disable / Enable Hardware
 * Acceleration" toggle.
 *
 * GPU compositing occasionally misrenders on broken driver stacks
 * (blank window, artifacts, runaway GPU-process CPU); the standard
 * escape hatch is `app.disableHardwareAcceleration()`. Chromium reads
 * that exactly once, before `app` is ready, so the choice must persist
 * across launches and apply at boot — not when the menu item is
 * clicked. Same marker-file idiom as `launch-flags`: flag file present
 * in `userData` ⇒ next boot disables acceleration.
 *
 * `toggleHardwareAcceleration` flips the marker and offers a restart.
 * Until the restart happens the menu label (derived from the marker,
 * not the running state) shows the pending choice, so a second click
 * before restarting simply undoes the first.
 */

import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, dialog } from 'electron';
import { createLogger } from './logger';
import { relaunchApp } from './relaunch';

const logger = createLogger('hardware-acceleration');

const DISABLE_FLAG_FILENAME = 'disable-hardware-acceleration.flag';

function flagPath(): string {
  return join(app.getPath('userData'), DISABLE_FLAG_FILENAME);
}

/** Target state for the NEXT launch (marker presence), not the running state. */
export function isHardwareAccelerationDisabled(): boolean {
  try {
    return existsSync(flagPath());
  } catch {
    return false;
  }
}

/**
 * Apply the persisted policy. Must run before `app.whenReady()` —
 * Chromium consumes `disableHardwareAcceleration()` once at GPU-process
 * construction and ignores later calls.
 */
export function applyHardwareAccelerationPolicy(): void {
  if (isHardwareAccelerationDisabled()) {
    app.disableHardwareAcceleration();
  }
}

/**
 * Flip the persisted policy, then offer to restart. Returns after the
 * marker is written so the caller can rebuild the menu with the new
 * label; the restart branch tears the process down asynchronously.
 */
export async function toggleHardwareAcceleration(): Promise<void> {
  const disable = !isHardwareAccelerationDisabled();
  try {
    if (disable) {
      writeFileSync(flagPath(), '');
    } else {
      unlinkSync(flagPath());
    }
  } catch (err) {
    logger.error('failed to persist hardware-acceleration flag', err);
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Hardware Acceleration',
    message: `Hardware acceleration will be ${disable ? 'disabled' : 'enabled'} the next time ${app.getName()} starts.`,
    detail: 'Restart now to apply the change immediately.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) relaunchApp();
}
