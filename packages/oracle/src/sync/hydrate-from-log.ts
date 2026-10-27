/**
 * Boot by replay — the one hydration routine every scope's service runs
 * before anything reads its oracle (the sync-engine design §9.1: the
 * log is the source of truth and every store derives from it).
 *
 * The replay buffers before it applies, so a failure leaves the oracle
 * empty rather than half-filled; the caches then migrate their stored
 * projections as on a first boot. Never rejects: a host must still
 * boot, and a scope whose log cannot be read starts empty with the
 * failure logged.
 */

import { logger } from '@openheaders/core/utils';
import type { MutationLog } from './mutation-log';
import type { EntityOracle } from './oracle';

export async function hydrateOracleFromLog(
  oracle: EntityOracle,
  log: MutationLog,
  loggerTag: string,
  scope: string,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const replayed = await oracle.hydrate(log.readSince(null));
    logger.info(loggerTag, `Hydrated ${replayed} envelope(s) from the log in ${Date.now() - startedAt} ms (${scope})`);
  } catch (err) {
    logger.warn(loggerTag, `Hydrating ${scope} from the log failed; the oracle starts empty`, err);
  }
}
