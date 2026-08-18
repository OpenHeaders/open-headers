/**
 * Migration pull run bookkeeping — the two storage slots the silent
 * resume story (the extension account-pull plan §2, Phase C) consumes,
 * written and cleared by the run host while a local pull is in flight.
 *
 * Two slots, two lifetimes, one law:
 *
 *   - The RUN MARKER lives in `chrome.storage.local` so it survives a
 *     full browser restart — that is how a restarted browser knows a run
 *     was interrupted and can surface the re-ask-key Resume. It carries
 *     bookkeeping ONLY: runId, the selection step's workspace choice,
 *     the highest broadcast seq observed, and the start stamp. NEVER
 *     the API key.
 *   - The SESSION KEY lives in `chrome.storage.session` (memory-backed,
 *     never disk, SW-only default access) strictly for the run's
 *     lifetime, bound to its runId so a stale key can never resume a
 *     different run. It survives MV3 idle-kills within a browser
 *     session — the silent-resume mechanism — and a browser restart
 *     genuinely clears it.
 *
 * Both slots clear the moment the run settles, whatever the outcome —
 * a marker exists only while a run is in flight.
 */

import { logger } from '@utils/logger';

const SCOPE = 'MigrationRunMarker';

const RUN_MARKER_SLOT = 'migration.pullRunMarker';
const SESSION_KEY_SLOT = 'migration.pullSessionKey';

/** Bookkeeping for an in-flight local pull — never carries the key. */
export interface MigrationPullRunMarker {
  runId: string;
  /** The selection step's choice; absent = the whole account. */
  workspaceIds?: string[];
  /** Highest `migrationPullEvent` seq broadcast so far. */
  seq: number;
  /** ISO stamp of the run's acceptance. */
  startedAt: string;
}

/** The session-storage entry pairing the key with its one run. */
export interface MigrationPullSessionKey {
  runId: string;
  apiKey: string;
}

function localArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  return chrome.storage.local;
}

function sessionArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
  return chrome.storage.session;
}

/** Validate a stored marker — a malformed slot reads as absent. */
export function readMigrationPullRunMarkerValue(raw: unknown): MigrationPullRunMarker | null {
  if (!raw || typeof raw !== 'object') return null;
  const { runId, workspaceIds, seq, startedAt } = raw as {
    runId?: unknown;
    workspaceIds?: unknown;
    seq?: unknown;
    startedAt?: unknown;
  };
  if (typeof runId !== 'string' || runId.length === 0) return null;
  if (typeof seq !== 'number' || !Number.isFinite(seq)) return null;
  if (typeof startedAt !== 'string') return null;
  if (workspaceIds !== undefined) {
    if (!Array.isArray(workspaceIds) || !workspaceIds.every((id): id is string => typeof id === 'string')) return null;
    return { runId, workspaceIds, seq, startedAt };
  }
  return { runId, seq, startedAt };
}

export async function writeMigrationRunMarker(marker: MigrationPullRunMarker): Promise<void> {
  const area = localArea();
  if (!area) return;
  try {
    await area.set({ [RUN_MARKER_SLOT]: marker });
  } catch (err) {
    logger.info(SCOPE, `marker write failed: ${(err as Error).message}`);
  }
}

export async function readMigrationRunMarker(): Promise<MigrationPullRunMarker | null> {
  const area = localArea();
  if (!area) return null;
  try {
    const result = await area.get(RUN_MARKER_SLOT);
    return readMigrationPullRunMarkerValue(result[RUN_MARKER_SLOT]);
  } catch (err) {
    logger.info(SCOPE, `marker read failed: ${(err as Error).message}`);
    return null;
  }
}

export async function clearMigrationRunMarker(): Promise<void> {
  const area = localArea();
  if (!area) return;
  try {
    await area.remove(RUN_MARKER_SLOT);
  } catch (err) {
    logger.info(SCOPE, `marker clear failed: ${(err as Error).message}`);
  }
}

export async function writeMigrationSessionKey(runId: string, apiKey: string): Promise<void> {
  const area = sessionArea();
  if (!area) return;
  try {
    await area.set({ [SESSION_KEY_SLOT]: { runId, apiKey } satisfies MigrationPullSessionKey });
  } catch (err) {
    logger.info(SCOPE, `session key write failed: ${(err as Error).message}`);
  }
}

export async function readMigrationSessionKey(): Promise<MigrationPullSessionKey | null> {
  const area = sessionArea();
  if (!area) return null;
  try {
    const result = await area.get(SESSION_KEY_SLOT);
    const raw = result[SESSION_KEY_SLOT];
    if (!raw || typeof raw !== 'object') return null;
    const { runId, apiKey } = raw as { runId?: unknown; apiKey?: unknown };
    if (typeof runId !== 'string' || runId.length === 0) return null;
    if (typeof apiKey !== 'string' || apiKey.length === 0) return null;
    return { runId, apiKey };
  } catch (err) {
    logger.info(SCOPE, `session key read failed: ${(err as Error).message}`);
    return null;
  }
}

export async function clearMigrationSessionKey(): Promise<void> {
  const area = sessionArea();
  if (!area) return;
  try {
    await area.remove(SESSION_KEY_SLOT);
  } catch (err) {
    logger.info(SCOPE, `session key clear failed: ${(err as Error).message}`);
  }
}
