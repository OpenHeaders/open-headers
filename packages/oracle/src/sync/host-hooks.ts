/**
 * Host-supplied hooks the oracle uses to reach back into surfaces it
 * does not own. The oracle remains the source of truth for sync state;
 * these hooks let it notify the host of side-effects (rebuild rules,
 * drop resolver caches, append a log entry) without importing
 * host-internal modules.
 *
 * Production wiring lives in the host app's boot path
 * ({@link setOracleHostHooks} once at module-load). Tests can leave
 * hooks unset — every call site is null-safe.
 */

import type { LogEntry } from '@openheaders/core/types';

export interface OracleHostHooks {
  /**
   * Append one structured entry to the host's observability ring.
   * Omitted in tests; the oracle treats absence as "drop the event."
   */
  recordLog?: (entry: Omit<LogEntry, 'timestamp'>) => void;
  /**
   * Notify the rule-engine orchestrator that compiled DNR rules may
   * need to be rebuilt. Reason is a stable short tag carried into the
   * resulting log entry (e.g. `cache-invalidated`).
   */
  scheduleRuleEngineUpdate?: (reason: string) => void;
  /**
   * Drop the workspace-scoped variables-resolver state. Called when a
   * workspace is torn down (delete, sign-out, switch in test runs) so
   * stale resolution caches do not survive across owners.
   */
  disposeResolverStateForWorkspace?: (workspaceId: string) => void;
}

let hooks: OracleHostHooks = {};

/** Install (or replace) the host hooks. Safe to call before any sync activity. */
export function setOracleHostHooks(next: OracleHostHooks): void {
  hooks = next;
}

/** Read the current hooks. Callers should null-check each entry before invoking. */
export function getOracleHostHooks(): OracleHostHooks {
  return hooks;
}
