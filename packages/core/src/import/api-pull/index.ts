/**
 * Data API pull — migration ladder rung 3 (the migration plan §3.3).
 *
 * Same pure/impure split as the install/data scans: core owns the
 * endpoint table + pacing policy (`endpoints.ts`), the response
 * interpretation and pull-plan fold (`responses.ts`), the header-driven
 * budget + failure classification (`budget.ts`), and the progress-event
 * vocabulary the background-tasks broadcast rides (`types.ts`) — the
 * host adapter only sends the requests, holds the key in memory for the
 * run, and paces to the constants.
 */

export {
  classifyPullFailure,
  DEFAULT_RETRY_AFTER_SECONDS,
  type HeaderLookup,
  readRateBudget,
} from './budget';
export {
  collectionUrl,
  ENUMERATION_CALL_SPACING_MS,
  environmentUrl,
  ITEM_CALL_SPACING_MS,
  MAX_RATE_LIMIT_RETRIES,
  POSTMAN_API_KEY_HEADER,
  POSTMAN_DATA_API_ORIGIN,
  workspaceDetailUrl,
  workspaceGlobalsUrl,
  workspaceListUrl,
} from './endpoints';
export {
  foldPullEvent,
  initialPullRunState,
  type MigrationPullRunPhase,
  type MigrationPullRunState,
  startPullRunState,
} from './progress';
export {
  buildPullPlan,
  type Interpreted,
  type PulledPayload,
  readCollectionPayload,
  readEnvironmentPayload,
  readWorkspaceDetail,
  readWorkspaceGlobals,
  readWorkspaceList,
  type WorkspaceDetail,
  type WorkspaceGlobalsRead,
  type WorkspaceItemRef,
  type WorkspaceListRead,
} from './responses';
export type {
  PostmanImportedWorkspace,
  PostmanImportSummary,
  PostmanPullEvent,
  PostmanPullOutcome,
  PostmanPullPlan,
  PostmanPullResult,
  PostmanPullSkip,
  PostmanWorkspaceListResult,
  PostmanWorkspacePreview,
  PulledCollection,
  PulledEnvironment,
  PulledWorkspaceGlobals,
  PullFailure,
  PullFailureKind,
  PullGlobalVariable,
  PullPlanItem,
  PullRateBudget,
  PullWorkspaceSummary,
} from './types';
