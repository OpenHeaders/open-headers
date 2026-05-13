/**
 * Test-run domain types.
 *
 * One run is launched against a single owner (rule / folder / collection
 * / workspace) and captures fires + per-rule statuses for that scope.
 * Persistence lives in the rule-engine; this file is the pure data shape
 * UI surfaces consume.
 */

import type { ShadowAttribution } from './shadow';
import type { Evidence } from './telemetry';

export type TestRuleStatus = 'executed' | 'no-fire' | 'skipped';

export type TestRunOwnerType = 'rule' | 'folder' | 'collection' | 'workspace';

export interface TestRunOwner {
  type: TestRunOwnerType;
  /** uid of the rule/folder/collection, or the active workspace id when type='workspace'. */
  id: string;
}

export interface TestFireEvent {
  ruleUid: string;
  url: string;
  evidence: Evidence;
  t: number;
  shadowedBy?: ShadowAttribution;
}

/**
 * The persisted shape of a finished test run. The owner is stamped
 * at run start; stale detection compares `ownerHashAtRun` against
 * a freshly computed hash of the owner's current content.
 */
export interface StoredTestRun {
  id: string;
  ownerType: TestRunOwnerType;
  ownerId: string;
  ownerNameAtRun: string;
  ruleUids: string[];
  url: string;
  startedAt: number;
  endedAt: number;
  waitSeconds: number;
  fires: TestFireEvent[];
  ruleStatuses: Record<string, TestRuleStatus>;
  noFireReasons?: Record<string, ShadowAttribution>;
  ownerHashAtRun: string;
}

/** A stored run decorated with the freshly computed stale flag. */
export type LoadedTestRun = StoredTestRun & { isStale: boolean };
