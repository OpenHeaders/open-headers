/**
 * Data API endpoints + pacing policy (MIGRATION_PLAN.md §3.3). Two rate
 * buckets shape the run: the enumeration endpoints (workspace list +
 * detail) ride a strict 10-calls-per-10-seconds bucket, so enumeration
 * is serial at ~1 call/s; per-item pulls ride only the 300 rpm global
 * limit, so one launch per 200 ms.
 */

export const POSTMAN_DATA_API_ORIGIN = 'https://api.postman.com';

/** Header NAME only — the key value never reaches logs, events, or reports. */
export const POSTMAN_API_KEY_HEADER = 'X-Api-Key';

/** Serial spacing between enumeration calls (the 10-per-10s bucket). */
export const ENUMERATION_CALL_SPACING_MS = 1000;

/** Spacing between item-pull launches (the 300 rpm global limit). */
export const ITEM_CALL_SPACING_MS = 200;

/** Consecutive 429 pauses tolerated per call before it fails as an error. */
export const MAX_RATE_LIMIT_RETRIES = 5;

export function workspaceListUrl(): string {
  return `${POSTMAN_DATA_API_ORIGIN}/workspaces`;
}

export function workspaceDetailUrl(id: string): string {
  return `${POSTMAN_DATA_API_ORIGIN}/workspaces/${encodeURIComponent(id)}`;
}

export function collectionUrl(id: string): string {
  return `${POSTMAN_DATA_API_ORIGIN}/collections/${encodeURIComponent(id)}`;
}

export function environmentUrl(id: string): string {
  return `${POSTMAN_DATA_API_ORIGIN}/environments/${encodeURIComponent(id)}`;
}
