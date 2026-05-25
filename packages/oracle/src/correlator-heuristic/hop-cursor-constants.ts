/**
 * Per-tab cap on the {@link HopCursor} map. One entry per in-flight
 * lifecycle; the same envelope as {@link MAX_IN_FLIGHT_URLS_PER_TAB}
 * since the cursor and the FIFO are populated in lockstep at
 * `onBeforeRequest`.
 */
export const MAX_HOP_CURSORS_PER_TAB = 5_000;
