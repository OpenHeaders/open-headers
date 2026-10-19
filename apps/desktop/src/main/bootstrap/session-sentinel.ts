/**
 * Clean-exit sentinel (the crash-and-error-reports plan §3.3). A lock
 * file is written at boot and removed by the lifecycle teardown; a
 * lock still present at the NEXT boot means the previous run never
 * reached a clean quit — a force-kill, a power loss, a main-process
 * hang the person ended from the task manager. Main cannot witness its
 * own death; the sentinel is the honest record of it, written to the
 * log at the next launch (and, in a later slice, reported). Firefox
 * and Chrome keep the same marker ("didn't shut down properly").
 *
 * Same marker-file idiom as `launch-flags` / `hardware-acceleration`:
 * the file lives in `<userData>/state`. Install it INSIDE `whenReady`
 * after the quitting guard — a second instance that lost the
 * single-instance race must never write, or tear down, the winner's
 * lock.
 */

import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateDir } from './app-paths';
import { registerTeardown } from './lifecycle';
import { createLogger } from './logger';

const logger = createLogger('session-sentinel');

const LOCK_FILENAME = 'session.lock';
const TEARDOWN_DEADLINE_MS = 500;

let previousSessionDirty = false;

function lockPath(): string {
  return join(stateDir(), LOCK_FILENAME);
}

/** Whether the run before this one ended without a clean quit (read once at install). */
export function wasPreviousSessionDirty(): boolean {
  return previousSessionDirty;
}

export function installSessionSentinel(): void {
  const path = lockPath();
  try {
    previousSessionDirty = existsSync(path);
  } catch (err) {
    logger.warn('failed to read the session sentinel', err);
    previousSessionDirty = false;
  }
  if (previousSessionDirty) {
    logger.error('previous session ended without a clean quit (the session sentinel was still present)');
  }
  try {
    writeFileSync(path, String(process.pid));
  } catch (err) {
    logger.warn('failed to write the session sentinel', err);
    return;
  }
  registerTeardown('session-sentinel', TEARDOWN_DEADLINE_MS, () => {
    try {
      unlinkSync(path);
    } catch (err) {
      logger.warn('failed to remove the session sentinel', err);
    }
  });
}
