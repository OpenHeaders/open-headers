/**
 * Migration bridge RPCs — the Postman Data API pull run
 * (`docs/MIGRATION_PLAN.md` §3.3, surfaces per the MIGRATION_STATUS.md
 * S5 addendum). Node hosts with the migration ladder answer these;
 * progress rides the `migrationPullEvent` broadcast.
 *
 * Key handling is load-bearing (S5 decision): the API key crosses the
 * bridge once in `start`, lives in host memory for the run, and never
 * reaches events, state, reports, or logs.
 */

import type { MigrationPullRunState } from '../../import/api-pull/progress';

export interface MigrationPullStartResult {
  started: boolean;
  /** Present when the run was accepted. */
  runId?: string;
  /** Present when it was not — e.g. a run is already in flight. */
  reason?: string;
}

export interface MigrationRpc {
  /**
   * Start the background pull. One run at a time per host — a second
   * `start` while one is in flight answers `started: false` with the
   * reason. Resolves as soon as the run is accepted; progress and the
   * materialization tail arrive via `migrationPullEvent`.
   */
  'oh.migration.postmanPull.start': { req: { apiKey: string }; res: MigrationPullStartResult };
  /**
   * Folded state of the current (or last) run — late-joining surfaces
   * hydrate from this, then keep folding `migrationPullEvent` events
   * with the same core `foldPullEvent` reducer.
   */
  'oh.migration.postmanPull.getState': { req: Record<string, never>; res: MigrationPullRunState };
}
