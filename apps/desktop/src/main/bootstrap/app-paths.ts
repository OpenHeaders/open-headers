/**
 * The desktop userData layout — every on-disk location the app owns,
 * derived from one root (`app.getPath('userData')`; the override and
 * dev-suffix logic in `main.ts` therefore applies to all of it):
 *
 *   data/      backup-worthy user data — oracle.db, blobs/,
 *              license.key, settings.json (the spine's `dataDir`)
 *   state/     regenerable per-install state — window-state.json,
 *              hardware-acceleration + restart-hidden markers
 *   logs/      main.log (packaged macOS excepted — see bootstrap/logger)
 *   nm-host/   NM manifest staging
 *   chromium/  `sessionData` — Chromium's profile noise (caches, GPU
 *              blobs, Local Storage, service workers)
 *
 * `data/` vs `state/` is the backup boundary: copying `data/` to a new
 * machine carries everything the user owns; `state/` regenerates.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Backup-worthy user data — handed to the daemon spine as `dataDir`.
 * A plain join: every consumer (SQLite persistence, blob backend,
 * license slot, host storage) `mkdir -p`s its own parent on first write.
 */
export function dataDir(): string {
  return join(app.getPath('userData'), 'data');
}

/**
 * Regenerable per-install state. Created here because its writers are
 * bare `writeFileSync` callers (window bounds, boot marker files).
 */
export function stateDir(): string {
  const dir = join(app.getPath('userData'), 'state');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Chromium profile root — `app.setPath('sessionData', …)` at boot. */
export function sessionDataDir(): string {
  return join(app.getPath('userData'), 'chromium');
}
