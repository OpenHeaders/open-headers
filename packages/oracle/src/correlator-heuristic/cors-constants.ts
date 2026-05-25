/**
 * Constants for the H5/H6 CORS pipeline.
 *
 * Defensive per-tab cap on `CorsContextStore`. Pathological pages that
 * fire `onSendHeaders` without ever reaching a terminal phase would
 * otherwise leak. The cap matches `MAX_BODY_JOIN_KEYS_PER_TAB` — both
 * store per-request bookkeeping with the same lifetime envelope (request
 * start → terminal phase).
 */

export const MAX_CORS_ENTRIES_PER_TAB = 5_000;
