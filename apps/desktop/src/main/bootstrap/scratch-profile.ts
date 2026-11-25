/**
 * A profile for a start that must leave both data folders alone.
 *
 * Chromium makes a profile folder as it starts, wherever `userData`
 * points. A start that only checks the package, or one that ends before
 * the data folder may be chosen, points it at a folder of its own under
 * the system's temporary folder — otherwise the default profile would
 * appear under Roaming AppData, beside the user's data.
 *
 * Chromium still holds files in that folder when the process ends, so it
 * is not removed by the start that made it: each start clears the ones
 * earlier starts left, once they are old enough not to be in use.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

const SCRATCH_PROFILE_PREFIX = 'openheaders-start-';
const STALE_AFTER_MS = 10 * 60_000;

export interface ScratchProfileSeams {
  /** Defaults to `Date.now`. */
  readonly now?: () => number;
}

/** Removes the scratch profiles earlier starts left in `tempDir`; one in use, or too young to tell, stays. */
export function clearStaleScratchProfiles(tempDir: string, seams: ScratchProfileSeams = {}): void {
  const now = (seams.now ?? Date.now)();
  let names: string[];
  try {
    names = fs.readdirSync(tempDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith(SCRATCH_PROFILE_PREFIX)) continue;
    const target = path.join(tempDir, name);
    try {
      if (now - fs.statSync(target).mtimeMs < STALE_AFTER_MS) continue;
      fs.rmSync(target, { recursive: true, force: true });
    } catch {
      // Still held, or gone already.
    }
  }
}

/** Makes a fresh scratch profile under `tempDir` and returns it. */
export function makeScratchProfile(tempDir: string, seams: ScratchProfileSeams = {}): string {
  clearStaleScratchProfiles(tempDir, seams);
  return fs.mkdtempSync(path.join(tempDir, SCRATCH_PROFILE_PREFIX));
}

/** Points this start at a scratch profile. Must run before the app is ready. */
export function startOnScratchProfile(): void {
  app.setPath('userData', makeScratchProfile(app.getPath('temp')));
}
