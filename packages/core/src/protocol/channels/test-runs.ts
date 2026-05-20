/**
 * Test-run bridge RPCs — start a run, list/read/delete persisted runs.
 */

import type { LoadedTestRun, TestRunOwnerType } from '../../types';

/**
 * Shape the bottom-panel Test Runs list renders. Matches the store's
 * `LoadedTestRun` (StoredTestRun + staleness flag) — the bridge contract
 * re-exports the name so callers don't need to know about the store.
 */
export type ListedTestRun = LoadedTestRun;

/** Final test run payload produced by `startTestRun`. */
export type StartTestRunResult = unknown;

export interface TestRunRpc {
  startTestRun: {
    req: {
      ownerType: TestRunOwnerType;
      ownerId: string;
      scopeLabel: string;
      ruleUids: string[];
      url: string;
      waitSeconds: number;
    };
    res: { success: boolean; result?: StartTestRunResult; error?: string };
  };
  listTestRunsForOwner: {
    req: { ownerType: TestRunOwnerType; ownerId: string };
    res: { success: boolean; runs?: ListedTestRun[]; error?: string };
  };
  listAllTestRuns: {
    req: Record<string, never>;
    res: { success: boolean; runs?: ListedTestRun[]; error?: string };
  };
  getTestRun: {
    req: { runId: string };
    res: { success: boolean; run?: LoadedTestRun | null; error?: string };
  };
  deleteTestRun: {
    req: { runId: string };
    res: { success: boolean; error?: string };
  };
  deleteAllTestRunsForOwner: {
    req: { ownerType: TestRunOwnerType; ownerId: string };
    res: { success: boolean; error?: string };
  };
}
