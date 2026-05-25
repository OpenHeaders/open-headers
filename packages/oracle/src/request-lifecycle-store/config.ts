/**
 * Store configuration constants.
 *
 * `MAX_LIFECYCLES_PER_TAB` bounds memory at the same level the legacy
 * `inFlightByUrl` LRU bounded it — moved up one layer, kept the same
 * shape. A long-running tab cannot accumulate unbounded lifecycles; the
 * oldest entries are evicted first (Map insertion order = LRU order).
 */

export const DEFAULT_MAX_LIFECYCLES_PER_TAB = 10_000;
