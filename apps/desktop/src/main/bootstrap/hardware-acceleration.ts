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
 * in `<userData>/state` ⇒ next boot disables acceleration.
 *
 * `toggleHardwareAcceleration` flips the marker and offers a restart.
 * Until the restart happens the menu label (derived from the marker,
 * not the running state) shows the pending choice, so a second click
 * before restarting simply undoes the first.
 */

import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, dialog } from 'electron';
import { stateDir } from './app-paths';
import { mainTranslator } from './locale';
import { createLogger } from './logger';
import { relaunchApp } from './relaunch';

const logger = createLogger('hardware-acceleration');

const DISABLE_FLAG_FILENAME = 'disable-hardware-acceleration.flag';

function flagPath(): string {
  return join(stateDir(), DISABLE_FLAG_FILENAME);
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
 * Persist "acceleration off" for the next launch — the escape the
 * window supervisor's crash dialog and the graphics-process watch
 * offer (the crash-and-error-reports plan §3.3). Idempotent; false
 * only when the marker could not be written.
 */
export function disableHardwareAccelerationOnNextLaunch(): boolean {
  try {
    writeFileSync(flagPath(), '');
    return true;
  } catch (err) {
    logger.error('failed to persist hardware-acceleration flag', err);
    return false;
  }
}

let escapeOffered = false;

/**
 * The graphics-process escape: after the GPU process has died twice
 * in one session, offer ONCE to restart with acceleration off.
 * Chromium's own software fallback stays the first line; this is the
 * second, and a person decides it.
 */
export async function offerHardwareAccelerationEscape(): Promise<void> {
  if (escapeOffered || isHardwareAccelerationDisabled()) return;
  escapeOffered = true;
  const t = mainTranslator();
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: t('desktop.dialog.gpuCrashed.title'),
    message: t('desktop.dialog.gpuCrashed.message'),
    detail: t('desktop.dialog.gpuCrashed.detail'),
    buttons: [t('desktop.dialog.gpuCrashed.restartWithoutAcceleration'), t('desktop.dialog.gpuCrashed.later')],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0 && disableHardwareAccelerationOnNextLaunch()) relaunchApp();
}

/** Test seam: forget that the escape was offered. */
export function resetHardwareAccelerationEscapeForTests(): void {
  escapeOffered = false;
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

  const t = mainTranslator();
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: t('desktop.dialog.hardwareAcceleration.title'),
    message: disable
      ? t('desktop.dialog.hardwareAcceleration.willBeDisabled', { name: app.getName() })
      : t('desktop.dialog.hardwareAcceleration.willBeEnabled', { name: app.getName() }),
    detail: t('desktop.dialog.hardwareAcceleration.detail'),
    buttons: [t('desktop.dialog.hardwareAcceleration.restartNow'), t('desktop.dialog.hardwareAcceleration.later')],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) relaunchApp();
}
