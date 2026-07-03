/**
 * Refresh adapter port (Phase D fills this in) — the seam through
 * which the scheduler delegates actual chain execution to
 * `live-chain-adapter` without importing it.
 */

import type { LiveWorkflow } from '@openheaders/core/types';

export interface LiveRefreshAdapter {
  /**
   * Execute a workflow's chain of steps against the given env and
   * write the result to the cache (either `putWorkflowRunCache` on
   * success or `recordRefreshError` on failure). Thrown errors are
   * still caught by the scheduler and folded into `recordRefreshError`,
   * but well-behaved adapters handle the cache write themselves so
   * they can carry richer context (failed step id, extractor fault).
   *
   * `bypass: true` signals that the caller is running a manual-bypass
   * attempt against an OPEN circuit — the adapter MUST route failure
   * writes through `recordManualBypassFailureForRun` (preserves
   * `nextAttemptAt` + `consecutiveOpenings`) instead of the normal
   * `recordRefreshError` path. Success writes go through the usual
   * `putWorkflowRunCache` either way; success closes the circuit.
   */
  refreshWorkflow(args: {
    workspaceId: string;
    workflow: LiveWorkflow;
    environmentId: string | null;
    bypass?: boolean;
  }): Promise<void>;
}

export let refreshAdapter: LiveRefreshAdapter | null = null;

/**
 * Install or clear the refresh adapter. Phase D's `live-chain-adapter`
 * calls this at module-load; tests may install a mock. Passing `null`
 * forces the "scheduler-not-ready" error path.
 */
export function __setLiveRefreshAdapter(adapter: LiveRefreshAdapter | null): void {
  refreshAdapter = adapter;
}
