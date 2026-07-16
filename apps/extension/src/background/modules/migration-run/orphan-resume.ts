/**
 * Orphaned-run detection on SW boot — the silent-resume story
 * (EXTENSION_ACCOUNT_PULL_PLAN.md §2, amended: resume is SILENT).
 *
 * A run marker with no live run means the previous SW died mid-pull.
 * Three legs:
 *
 *   - Session key survives (MV3 idle-kill within the browser session)
 *     AND is bound to the marker's run → resume silently: start a fresh
 *     run with the same key and the same selection. The user never sees
 *     the SW die. Re-materialization is idempotent by construction — a
 *     complete re-pull replaces the dead run's partial landing by
 *     provenance (`materializePostmanPull`'s refresh semantics), never
 *     duplicating it.
 *   - Key gone or bound to a different run (browser restart cleared
 *     `chrome.storage.session`) → honest interruption: the run host
 *     adopts the marker as an interrupted terminal state, surfaced
 *     through the normal getState/broadcast plane. The marker stays put
 *     so every later boot keeps surfacing it until a new run supersedes
 *     it — never silent loss.
 *   - A run is already live on this host → nothing to do; the live run
 *     owns the slots.
 */

import { logger } from '@utils/logger';
import { getSwMigrationRunHost } from './run-host';
import { readMigrationRunMarker, readMigrationSessionKey } from './run-marker';

const SCOPE = 'MigrationOrphanResume';

export async function resumeOrphanedMigrationPull(): Promise<void> {
  const marker = await readMigrationRunMarker();
  if (marker === null) return;
  const host = getSwMigrationRunHost();
  if (host.getState().runId !== null) return;
  const key = await readMigrationSessionKey();
  if (key !== null && key.runId === marker.runId) {
    logger.info(SCOPE, 'resuming an interrupted migration pull with the session key');
    try {
      const result = await host.start(key.apiKey, marker.workspaceIds);
      if (result.started) return;
      logger.info(SCOPE, `silent resume was refused: ${result.reason ?? 'unknown reason'}`);
    } catch (err) {
      logger.warn(SCOPE, `silent resume failed: ${(err as Error).message}`);
    }
    // A resume that could not start must not die silently — fall
    // through to the honest interruption so the user sees the run
    // ended and knows re-running finishes it.
  } else {
    logger.info(SCOPE, 'orphaned migration pull found with no session key — surfacing as interrupted');
  }
  host.adoptInterruptedRun(marker);
}
