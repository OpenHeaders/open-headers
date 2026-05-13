/**
 * Boot telemetry — cold-start phase markers (Phase A T1 baseline gate).
 *
 * Captures wall-clock elapsed-ms between SW evaluation start and each
 * named init phase, recording one observability entry per phase. The
 * resulting timeline answers the no-regression question for §22.1's
 * cold-start gate: can we apply a mutation through the oracle as fast
 * as the legacy `updateRule` write path?
 *
 * Module-load side effect: stamps `SW_BOOT_AT = Date.now()` at the top
 * of file evaluation. Imported once from `background.ts` so the SW's
 * very first user-defined import is the one that anchors t=0; later
 * call sites pass through the same anchor.
 *
 * Phases (all logged under `subsystem: 'sync', op: 'boot.<phase>'`):
 *
 *   - `sw-eval`         — module-load. Marks the t=0 anchor itself.
 *   - `settings-ready`  — `bootstrapSettings()` resolved.
 *   - `hydration-done`  — `hydrateActiveWorkspaceStores()` returned.
 *   - `sync-init-done`  — `initSyncService(...)` finished.
 *   - `bridge-done`     — `bridgeToSyncEngine()` resolved.
 *   - `interactive`     — `backgroundReady` released. Alarm dispatch +
 *                          renderer surfaces can read in-memory state.
 *
 * Each phase is recorded once per SW lifetime — re-firing the same
 * phase is a no-op, which keeps `runtime.onStartup` / `runtime.onInstalled`
 * double-fires (Chrome calls both on first install) from inflating the
 * baseline.
 */

import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { logger } from '@utils/logger';

const SW_BOOT_AT = Date.now();

export type BootPhase =
  | 'sw-eval'
  | 'settings-ready'
  | 'hydration-done'
  | 'sync-init-done'
  | 'bridge-done'
  | 'interactive';

const seen = new Set<BootPhase>();

export function markBootPhase(phase: BootPhase): void {
  if (seen.has(phase)) return;
  seen.add(phase);
  const elapsedMs = Date.now() - SW_BOOT_AT;
  getOracleHostHooks().recordLog?.({
    subsystem: 'sync',
    op: `boot.${phase}`,
    level: 'info',
    message: `Boot phase ${phase} reached at +${elapsedMs}ms`,
    context: { phase, phaseElapsedMs: elapsedMs },
  });
  logger.debug('SyncBoot', `${phase} +${elapsedMs}ms`);
}

export function getSwBootAt(): number {
  return SW_BOOT_AT;
}

// Mark t=0 immediately so the observability log has at least one entry
// even on installs that crash mid-init. The recordLog call buffers
// through `observability-log` which tolerates pre-hydration writes (its
// own contract — see observability-log.ts).
markBootPhase('sw-eval');
