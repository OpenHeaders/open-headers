/**
 * SW-side migration pull run host — the extension leg of "one runner,
 * no forks" (EXTENSION_ACCOUNT_PULL_PLAN.md §2): the lifted
 * `@openheaders/oracle/migration` runner wired to this host's ports.
 * The service worker's global `fetch` is the network port (the
 * extension holds `<all_urls>`, so the Data API call carries the
 * `X-Api-Key` header without CORS ceremony), the SW's own sync service
 * takes the materializer's writes, and every locally-produced
 * `PostmanPullEvent` fans to open surfaces as the same ONE
 * `migrationPullEvent` broadcast the desktop emits — the
 * background-task tenant folds both producers identically.
 *
 * Run bookkeeping (Phase C's silent-resume feed): acceptance persists
 * the run marker (`chrome.storage.local`, bookkeeping only) and the
 * session key (`chrome.storage.session`, bound to the runId); each
 * broadcast bumps the marker's seq; settling clears both, whatever the
 * outcome. The key itself stays out of state, events, reports, logs,
 * and the marker — the session slot is its only home outside the
 * runner's closure.
 */

import {
  foldPullEvent,
  type MigrationPullRunState,
  type PostmanPullEvent,
  type PostmanWorkspaceListResult,
  startPullRunState,
} from '@openheaders/core/import';
import {
  createMigrationPullRunner,
  listPostmanWorkspaces,
  type MigrationPullRunnerOptions,
  type MigrationPullStartResult,
  type PullFetchFn,
} from '@openheaders/oracle/migration';
import { broadcast } from '@utils/bridge';
import {
  clearMigrationRunMarker,
  clearMigrationSessionKey,
  type MigrationPullRunMarker,
  writeMigrationRunMarker,
  writeMigrationSessionKey,
} from './run-marker';

/** The SW's global fetch as the runner's network port. */
const swPullFetch: PullFetchFn = (url, init) => fetch(url, init);

export interface SwMigrationRunHostOptions {
  /** Test seams — production runs SW fetch + the real pipeline. */
  fetchFn?: PullFetchFn;
  pull?: MigrationPullRunnerOptions['pull'];
  materialize?: MigrationPullRunnerOptions['materialize'];
}

export interface SwMigrationRunHost {
  /** The selection step's enumeration preflight, on this host's fetch. */
  listWorkspaces(apiKey: string): Promise<PostmanWorkspaceListResult>;
  /**
   * Accept and launch a local run. Resolves once the run is accepted
   * AND its marker + session key are durably written, so an SW death
   * right after acceptance is already resumable.
   */
  start(apiKey: string, workspaceIds?: string[]): Promise<MigrationPullStartResult>;
  getState(): MigrationPullRunState;
  /** True for any run this host started in its lifetime. */
  isLocalRun(runId: string): boolean;
  /**
   * Surface an orphaned run whose session key is gone (browser
   * restart): fold the marker into an interrupted terminal state that
   * `getState` answers and open surfaces receive live — honest
   * interruption, never a zombie task. A new local `start` supersedes
   * it. Re-running the import IS the resume: a complete re-pull
   * replaces the dead run's partial landing by provenance, never
   * duplicating it.
   */
  adoptInterruptedRun(marker: MigrationPullRunMarker): void;
  /** Resolves once the in-flight run (if any) settles — test hook. */
  settled(): Promise<void>;
}

/**
 * The interrupted surface's one message — folded into state AND
 * broadcast, so hydrating and live-following surfaces read the same
 * words. Deliberately names the remedy: re-running the import finishes
 * the job without duplicates.
 */
export const MIGRATION_PULL_INTERRUPTED_REASON =
  'The import was interrupted by a browser restart before it finished. Run it again to finish — anything already imported is replaced, not duplicated.';

export function createSwMigrationRunHost(options: SwMigrationRunHostOptions = {}): SwMigrationRunHost {
  const fetchFn = options.fetchFn ?? swPullFetch;
  const localRunIds = new Set<string>();
  let marker: MigrationPullRunMarker | null = null;
  /** Synthesized state of a key-gone orphan — a new run supersedes it. */
  let interrupted: MigrationPullRunState | null = null;

  const runner = createMigrationPullRunner({
    fetchFn,
    broadcast: (type, payload) => {
      if (type !== 'migrationPullEvent') return;
      // The runner emits exactly the broadcast contract's frame shape.
      const frame = payload as { runId: string; seq: number; event: PostmanPullEvent };
      broadcast('migrationPullEvent', frame);
      if (marker !== null && marker.runId === frame.runId) {
        marker = { ...marker, seq: frame.seq };
        void writeMigrationRunMarker(marker);
      }
    },
    ...(options.pull !== undefined ? { pull: options.pull } : {}),
    ...(options.materialize !== undefined ? { materialize: options.materialize } : {}),
  });

  return {
    listWorkspaces: (apiKey) => listPostmanWorkspaces({ apiKey, fetchFn }),
    async start(apiKey, workspaceIds) {
      const result = runner.start(apiKey, workspaceIds);
      if (!result.started || result.runId === undefined) return result;
      const runId = result.runId;
      localRunIds.add(runId);
      interrupted = null;
      marker = {
        runId,
        ...(workspaceIds !== undefined ? { workspaceIds } : {}),
        seq: 0,
        startedAt: new Date().toISOString(),
      };
      await writeMigrationRunMarker(marker);
      await writeMigrationSessionKey(runId, apiKey);
      void runner.settled().then(async () => {
        if (marker?.runId === runId) marker = null;
        await clearMigrationSessionKey();
        await clearMigrationRunMarker();
      });
      return result;
    },
    getState: () => {
      const state = runner.getState();
      return state.runId === null && interrupted !== null ? interrupted : state;
    },
    isLocalRun: (runId) => localRunIds.has(runId),
    adoptInterruptedRun(orphan) {
      if (runner.getState().runId !== null) return;
      const event: PostmanPullEvent = { kind: 'import-failed', reason: MIGRATION_PULL_INTERRUPTED_REASON };
      interrupted = foldPullEvent(startPullRunState(orphan.runId), event);
      localRunIds.add(orphan.runId);
      broadcast('migrationPullEvent', { runId: orphan.runId, seq: orphan.seq + 1, event });
    },
    settled: () => runner.settled(),
  };
}

let singleton: SwMigrationRunHost | null = null;

export function getSwMigrationRunHost(): SwMigrationRunHost {
  singleton ??= createSwMigrationRunHost();
  return singleton;
}

/**
 * Mirror-dedupe probe: true when this host produced the run, so a
 * desktop-forwarded frame with the same runId must not re-broadcast.
 * Never constructs the host — no local run has happened if it doesn't
 * exist yet.
 */
export function isLocalMigrationPullRun(runId: string): boolean {
  return singleton?.isLocalRun(runId) ?? false;
}
