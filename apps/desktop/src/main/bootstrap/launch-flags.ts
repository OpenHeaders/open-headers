/**
 * Hide-on-launch signals. Two sources, equivalent intent:
 *
 *   1. `--hidden` argv flag — passed by `auto-launch` (and other
 *      caller-controlled launches) so the app boots silently into the
 *      tray. Window is created but not shown; first reveal is a
 *      tray click / `app.on('activate')`.
 *
 *   2. Restart-hidden marker file — written synchronously by code paths
 *      that call `app.relaunch()` (e.g. an in-app restart or
 *      `auto-updater.installUpdate()`) when the window was hidden at the
 *      moment of restart. Consumed on the next boot so the relaunch
 *      doesn't flash the window visible.
 *
 * Read once at startup and cached: this lets later code (`tray`,
 * `protocol`) check the result without re-stat'ing the marker file
 * each call.
 */

import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { createLogger } from './logger';

const logger = createLogger('launch-flags');

const HIDDEN_ARGV_FLAG = '--hidden';
const RESTART_HIDDEN_FILENAME = 'restart-hidden.flag';

function restartHiddenPath(): string {
  return join(app.getPath('userData'), RESTART_HIDDEN_FILENAME);
}

let cached: boolean | null = null;

export function shouldLaunchHidden(): boolean {
  if (cached !== null) return cached;
  const argvFlag = process.argv.includes(HIDDEN_ARGV_FLAG);
  let restartFlag = false;
  try {
    const path = restartHiddenPath();
    if (existsSync(path)) {
      restartFlag = true;
      unlinkSync(path);
    }
  } catch (err) {
    logger.warn('failed to consume restart-hidden flag', err);
  }
  cached = argvFlag || restartFlag;
  return cached;
}

/**
 * Persist the "next launch starts hidden" marker. Synchronous on purpose:
 * callers run this immediately before `app.relaunch()` + `app.quit()`,
 * which tear the process down before any async write would flush.
 */
export function writeRestartHiddenFlag(): void {
  try {
    writeFileSync(restartHiddenPath(), '');
  } catch (err) {
    logger.warn('failed to write restart-hidden flag', err);
  }
}
