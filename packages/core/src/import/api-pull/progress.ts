/**
 * Pull-run progress fold — the ONE derivation of surface state from the
 * `PostmanPullEvent` stream. The host folds it to answer the
 * `oh.migration.postmanPull.getState` hydration RPC; surfaces fold the
 * same events off the `migrationPullEvent` broadcast, so a late-joining
 * surface and a live-following one always converge on identical state.
 */

import type { PostmanImportSummary, PostmanPullEvent, PostmanPullOutcome } from './types';

export type MigrationPullRunPhase = 'idle' | 'enumerating' | 'pulling' | 'importing' | 'done';

export interface MigrationPullRunState {
  /** Null until a run has started in this host's lifetime. */
  runId: string | null;
  phase: MigrationPullRunPhase;
  /** The pull plan, once enumeration settled. */
  planned: { workspaces: number; collections: number; environments: number; totalCalls: number } | null;
  completedItems: number;
  totalItems: number;
  /** The most recent per-item outcome — the progress line's detail. */
  lastItem: {
    item: 'collection' | 'environment';
    id: string;
    name?: string;
    status: 'pulled' | 'skipped';
    reason?: string;
  } | null;
  /** Non-null while a 429 pause is in effect; cleared by the next progress. */
  pause: { retryAfterSeconds: number } | null;
  budget: { limitMonth?: number; remainingMonth?: number };
  /** Pull outcome once the puller finished; materialization may still follow. */
  outcome: PostmanPullOutcome | null;
  stopReason: string | null;
  pulled: { collections: number; environments: number; skipped: number } | null;
  imported: PostmanImportSummary | null;
  importError: string | null;
}

export function initialPullRunState(): MigrationPullRunState {
  return {
    runId: null,
    phase: 'idle',
    planned: null,
    completedItems: 0,
    totalItems: 0,
    lastItem: null,
    pause: null,
    budget: {},
    outcome: null,
    stopReason: null,
    pulled: null,
    imported: null,
    importError: null,
  };
}

/** Fresh state for a starting run — everything reset, the id stamped. */
export function startPullRunState(runId: string): MigrationPullRunState {
  return { ...initialPullRunState(), runId, phase: 'enumerating' };
}

export function foldPullEvent(state: MigrationPullRunState, event: PostmanPullEvent): MigrationPullRunState {
  switch (event.kind) {
    case 'enumerating':
      return { ...state, phase: 'enumerating', pause: null };
    case 'planned':
      return {
        ...state,
        phase: 'pulling',
        planned: {
          workspaces: event.workspaces,
          collections: event.collections,
          environments: event.environments,
          totalCalls: event.totalCalls,
        },
        totalItems: event.collections + event.environments,
        pause: null,
      };
    case 'item-progress':
      return {
        ...state,
        phase: 'pulling',
        completedItems: event.completedItems,
        totalItems: event.totalItems,
        lastItem: {
          item: event.item,
          id: event.id,
          ...(event.name !== undefined ? { name: event.name } : {}),
          status: event.status,
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
        },
        pause: null,
      };
    case 'rate-limit-pause':
      return { ...state, pause: { retryAfterSeconds: event.retryAfterSeconds } };
    case 'budget':
      return {
        ...state,
        budget: {
          ...(event.limitMonth !== undefined ? { limitMonth: event.limitMonth } : {}),
          ...(event.remainingMonth !== undefined ? { remainingMonth: event.remainingMonth } : {}),
        },
      };
    case 'finished':
      return {
        ...state,
        // The orchestrator's `importing` follows when anything was
        // pulled; a failed / empty run ends here.
        phase: 'done',
        outcome: event.outcome,
        stopReason: event.stopReason ?? null,
        pulled: { collections: event.collections, environments: event.environments, skipped: event.skipped },
        pause: null,
      };
    case 'importing':
      return { ...state, phase: 'importing' };
    case 'imported':
      return { ...state, phase: 'done', imported: event.summary };
    case 'import-failed':
      return { ...state, phase: 'done', importError: event.reason };
  }
}
