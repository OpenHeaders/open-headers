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
import type { PostmanWorkspaceListResult } from '../../import/api-pull/types';
import type { DataScanSkip, ToolDataFinding } from '../../import/data-scan';
import type { ToolInstallFinding } from '../../import/install-detect';

export interface MigrationScanResult {
  findings: ToolDataFinding[];
  skipped: DataScanSkip[];
}

export interface MigrationReadBackupResult {
  /** The backup file's JSON text, or null when the read was refused/failed. */
  text: string | null;
  /** Present when `text` is null. */
  reason?: string;
}

export interface MigrationReadInsomniaDataResult {
  /** The synthesized v4 export envelope's JSON text, or null when the read was refused/failed. */
  text: string | null;
  /** Present when `text` is null. */
  reason?: string;
}

export interface MigrationPullStartResult {
  started: boolean;
  /** Present when the run was accepted. */
  runId?: string;
  /** Present when it was not — e.g. a run is already in flight. */
  reason?: string;
}

export interface MigrationRpc {
  /**
   * Migration ladder rung 1 (consent click 1): run the per-OS install
   * probe allowlist and answer one finding per known tool. Read-only
   * and content-blind — never invoked without the user's explicit
   * gesture.
   */
  'oh.migration.detectTools': { req: Record<string, never>; res: ToolInstallFinding[] };
  /**
   * Migration ladder rung 2 (same consent click): enumerate the
   * allowlisted store directories and interpret matched data stores
   * into a findings inventory. Skips always carry reasons.
   */
  'oh.migration.scanToolData': { req: Record<string, never>; res: MigrationScanResult };
  /**
   * Read one scanned Postman backup file so the surface can route it
   * into the standard sectioned import flow. The host re-validates the
   * path against the scan allowlist before reading — an arbitrary path
   * is refused with a reason, never opened.
   */
  'oh.migration.readBackup': { req: { path: string }; res: MigrationReadBackupResult };
  /**
   * Read a scanned Insomnia data directory's NeDB stores and answer
   * them as a synthesized v4 export envelope, so the surface can route
   * the finding into the standard text import flow. The host
   * re-validates the directory against the scan allowlist and
   * re-enumerates the store files itself — an arbitrary path is refused
   * with a reason, never opened.
   */
  'oh.migration.readInsomniaData': { req: { dir: string }; res: MigrationReadInsomniaDataResult };
  /**
   * The selection step's preflight: enumerate the account's workspaces
   * with item counts so the user picks which ones to import. The key
   * rides this call's memory only — same law as `start`.
   */
  'oh.migration.postmanPull.listWorkspaces': { req: { apiKey: string }; res: PostmanWorkspaceListResult };
  /**
   * Start the background pull. One run at a time per host — a second
   * `start` while one is in flight answers `started: false` with the
   * reason. Resolves as soon as the run is accepted; progress and the
   * materialization tail arrive via `migrationPullEvent`.
   * `workspaceIds` narrows the pull to the selection step's choice;
   * omitted, every workspace on the account pulls.
   */
  'oh.migration.postmanPull.start': {
    req: { apiKey: string; workspaceIds?: string[] };
    res: MigrationPullStartResult;
  };
  /**
   * Folded state of the current (or last) run — late-joining surfaces
   * hydrate from this, then keep folding `migrationPullEvent` events
   * with the same core `foldPullEvent` reducer.
   */
  'oh.migration.postmanPull.getState': { req: Record<string, never>; res: MigrationPullRunState };
  /**
   * Stop the in-flight run. Only the pull phase is stoppable — a
   * canceled pull never materializes, so nothing lands and there is
   * nothing to clean up; once materialization started the data is
   * already local and the landing finishes. Answers `stopped: false`
   * when there is nothing stoppable (no run, already importing, or
   * already settled). The terminal state arrives like any other run
   * end: a `finished` event with the `canceled` outcome.
   */
  'oh.migration.postmanPull.stop': { req: Record<string, never>; res: { stopped: boolean } };
}
