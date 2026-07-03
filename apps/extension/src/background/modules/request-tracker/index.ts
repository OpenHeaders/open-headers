/**
 * Request Tracker — tracks which tabs have requests matching rules.
 *
 * Used for badge display and the Active tab in the popup.
 * Reads rules from the in-memory rule store (no storage reads in hot
 * paths). Pattern matching always uses the resolved-rule snapshot from
 * `variables-resolver` — rules with `{{VAR}}` in URL conditions only
 * match against the real, interpolated value. Falls back to the raw
 * rule-store view until the first DNR compile populates the snapshot.
 */

export type { ActiveRulesResult } from './active-rules';
export { getActiveRulesForTab } from './active-rules';
export {
  checkIfUrlMatchesAnyRule,
  type MatchingRule,
  type MatchingRuleHeaderOp,
  matchRulesToRequest,
  precompileRulePatterns,
} from './matching';
export { ingestPerfEntries } from './perf-ingestion';
export { revalidateTrackedRequests } from './revalidation';
export { rehydrateTabTracking, scheduleTabTrackingPersist } from './session-persistence';
export {
  type AddTrackedUrlOptions,
  addTrackedUrl,
  clearAllTracking,
  restoreTrackingState,
} from './tracking';
