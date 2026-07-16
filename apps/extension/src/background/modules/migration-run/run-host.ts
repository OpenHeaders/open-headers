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

import type { MigrationPullRunState, PostmanPullEvent, PostmanWorkspaceListResult } from '@openheaders/core/import';
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
  /** Resolves once the in-flight run (if any) settles — test hook. */
  settled(): Promise<void>;
}

export function createSwMigrationRunHost(options: SwMigrationRunHostOptions = {}): SwMigrationRunHost {
  const fetchFn = options.fetchFn ?? swPullFetch;
  const localRunIds = new Set<string>();
  let marker: MigrationPullRunMarker | null = null;

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
    getState: () => runner.getState(),
    isLocalRun: (runId) => localRunIds.has(runId),
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
