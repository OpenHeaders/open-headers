/**
 * Shared bounds for the H7 late-arrival pair: {@link HarWaitingBuffer}
 * (forward race) and {@link FinalizedRetention} (backward retention).
 *
 * Co-locating the constants keeps the invariant-8 window definition in
 * one place — tests, both buffers, and the correlator all import from
 * here. The window default matches `docs/REQUEST_LIFECYCLE_STATUS.md`
 * §Late-arrival behavior (5 000 ms).
 */

/**
 * Window during which an out-of-order event can still be attached to
 * its `(tabId, requestId)` lifecycle. Applies symmetrically:
 *   - HAR entries held in {@link HarWaitingBuffer} expire after this many
 *     ms past their own `startedDateTime`.
 *   - Finalized lifecycles retained in {@link FinalizedRetention} are
 *     released after this many ms past their terminal-phase timestamp.
 */
export const LATE_ARRIVAL_WINDOW_MS = 5_000;

/**
 * Per-tab cap on HAR entries held while waiting for their matching
 * `onBeforeRequest`. The forward race is rare in practice — held sets
 * are usually empty — but a misbehaving HAR pipeline (or a tab with no
 * webRequest traffic but lots of HAR) shouldn't be able to balloon
 * memory. LRU eviction drops the oldest held entry.
 */
export const MAX_HAR_WAITING_PER_TAB = 1_000;
