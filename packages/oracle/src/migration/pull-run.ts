/**
 * Pull-run orchestrator — one background Postman pull per host, wired
 * for the surfaces: every `PostmanPullEvent` (the puller's own plus
 * the materialization tail this module emits) folds into the run state
 * AND broadcasts as ONE `migrationPullEvent` message, so every
 * connected surface mirrors the same background-task state and a
 * late-joining one hydrates via `getState`.
 *
 * The key stays in this closure for the duration of `start`'s run —
 * it is handed to the puller and never reaches state, events,
 * broadcasts, or logs.
 */

import {
  foldPullEvent,
  initialPullRunState,
  type MigrationPullRunState,
  type PostmanPullEvent,
  type PostmanPullResult,
  startPullRunState,
} from '@openheaders/core/import';
import { generateUid, logger } from '@openheaders/core/utils';
import { type PullFetchFn, pullPostmanData } from './api-pull';
import { materializePostmanPull } from './materialize';

const SCOPE = 'migration-pull-run';

export interface MigrationPullStartResult {
  started: boolean;
  runId?: string;
  reason?: string;
}

export interface MigrationPullRunnerOptions {
  /** Fan-out to the host's surfaces — the spine's `broadcastLocal`. */
  broadcast: (type: string, payload: unknown) => void;
  /** The host's fetch port — undici on node, the SW's global fetch on the extension. */
  fetchFn: PullFetchFn;
  /** Stand-in Data API origin — a harness seam (e2e stub servers). */
  apiOrigin?: string;
  /** Test seams — production runs the real puller + materializer. */
  pull?: (options: {
    apiKey: string;
    workspaceIds?: string[];
    onEvent: (event: PostmanPullEvent) => void;
    isCanceled?: () => boolean;
  }) => Promise<PostmanPullResult>;
  materialize?: typeof materializePostmanPull;
}

export interface MigrationPullRunner {
  /**
   * Accept and launch a run unless one is already in flight.
   * `workspaceIds` narrows the pull to the selection step's choice;
   * omitted, every workspace on the account pulls.
   */
  start(apiKey: string, workspaceIds?: string[]): MigrationPullStartResult;
  /**
   * Stop the in-flight run. Only the pull phase is stoppable — the
   * puller notices at its next checkpoint and finishes with the
   * `canceled` outcome, which never materializes, so nothing lands.
   * False when there is nothing stoppable: no run, materialization
   * already started (the data is local; the landing finishes), or the
   * run already settled.
   */
  stop(): boolean;
  getState(): MigrationPullRunState;
  /** Resolves once the in-flight run (if any) settles — test hook. */
  settled(): Promise<void>;
}

export function createMigrationPullRunner(options: MigrationPullRunnerOptions): MigrationPullRunner {
  const pull =
    options.pull ??
    ((pullOptions: { apiKey: string; workspaceIds?: string[]; onEvent: (event: PostmanPullEvent) => void }) =>
      pullPostmanData({
        ...pullOptions,
        fetchFn: options.fetchFn,
        ...(options.apiOrigin !== undefined ? { apiOrigin: options.apiOrigin } : {}),
      }));
  const materialize = options.materialize ?? materializePostmanPull;

  let state: MigrationPullRunState = initialPullRunState();
  let running = false;
  let cancelRequested = false;
  let inFlight: Promise<void> = Promise.resolve();

  function emit(runId: string, seq: () => number, event: PostmanPullEvent): void {
    state = foldPullEvent(state, event);
    options.broadcast('migrationPullEvent', { runId, seq: seq(), event });
  }

  async function run(runId: string, apiKey: string, workspaceIds?: string[]): Promise<void> {
    let counter = 0;
    const seq = () => ++counter;
    try {
      // The puller resolves (never rejects) on every classified
      // failure; a rejection here is a programming error, surfaced
      // through the same terminal event so the run never looks stuck.
      const result = await pull({
        apiKey,
        ...(workspaceIds !== undefined ? { workspaceIds } : {}),
        onEvent: (event) => emit(runId, seq, event),
        isCanceled: () => cancelRequested,
      });
      // A failed run never enumerated anything; a canceled one is the
      // user's stop — nothing lands by contract; an empty one has
      // nothing to land. Everything else materializes — a labeled
      // partial included, so what DID arrive isn't discarded.
      const hasPayload =
        result.collections.length > 0 ||
        result.environments.length > 0 ||
        result.globals.some((entry) => entry.variables.length > 0);
      if (result.outcome === 'failed' || result.outcome === 'canceled' || !hasPayload) return;
      emit(runId, seq, { kind: 'importing' });
      const summary = await materialize(result);
      emit(runId, seq, { kind: 'imported', summary });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.warn(SCOPE, `pull run failed: ${reason}`);
      emit(runId, seq, { kind: 'import-failed', reason });
    } finally {
      running = false;
    }
  }

  return {
    start(apiKey: string, workspaceIds?: string[]): MigrationPullStartResult {
      if (running) {
        return { started: false, reason: 'A migration pull is already running on this host.' };
      }
      const runId = generateUid();
      running = true;
      cancelRequested = false;
      state = startPullRunState(runId);
      inFlight = run(runId, apiKey, workspaceIds);
      return { started: true, runId };
    },
    stop(): boolean {
      if (!running || state.phase === 'importing') return false;
      cancelRequested = true;
      return true;
    },
    getState: () => state,
    settled: () => inFlight,
  };
}
