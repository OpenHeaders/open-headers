/**
 * The offline gate every state-touching CLI command runs through: a
 * `/healthz` probe that refuses while the daemon is up. Callers supply
 * the consequence sentence — offline WRITES would be clobbered by the
 * running daemon's next `storage.json` flush (single-writer law), and
 * backup/restore additionally needs the data dir quiesced so
 * `storage.json`, `oracle.db`, and `blobs/` are mutually consistent.
 * Lives outside `cli.ts` so lazily-loaded command chunks reach it
 * without importing the entry module.
 */

import type { DaemonConfig } from '../config';
import { probeHealthz } from './healthz-probe';

export async function assertDaemonStopped(config: DaemonConfig, consequence: string): Promise<void> {
  if (await probeHealthz(config.bindPort)) {
    throw new Error(
      `the daemon is running on port ${config.bindPort} — stop it first (oh daemon stop). ${consequence}`,
    );
  }
}

/**
 * The single-writer consequence sentence shared by the offline
 * mutation family (mint, config set, user commands).
 */
export function offlineWriteConsequence(wouldBeLost: string, instead: string): string {
  return (
    `storage.json is single-writer; ${wouldBeLost} under a live daemon would be lost. ` +
    `While it runs, ${instead} from a connected admin surface instead.`
  );
}
