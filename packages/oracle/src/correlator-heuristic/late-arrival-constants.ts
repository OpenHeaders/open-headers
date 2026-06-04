/**
 * Shared bounds for the H7 late-arrival pair: {@link HarWaitingBuffer}
 * (forward race) and {@link FinalizedRetention} (backward retention).
 *
 * The two races are NOT symmetric, so they get separate windows:
 *
 *   - Forward race (HAR arrives before its `onBeforeRequest`) is a tiny
 *     intra-process reordering — a few ms in practice. A short hold
 *     window suffices and keeps the waiting buffer from bloating.
 *
 *   - Backward retention (HAR arrives after `onCompleted`) is bounded by
 *     how late the devtools HAR pipeline can deliver `onRequestFinished`
 *     relative to webRequest's `onCompleted`. Under slow/offline +
 *     heavy load this lag can reach many seconds. The retention must
 *     therefore outlive the in-flight join key — otherwise `popMatching`
 *     can still resolve a HAR (the join key lives `IN_FLIGHT_MAX_AGE_MS`)
 *     while `recentLifecycles` has already dropped the lifecycle, and
 *     the resolved HAR is silently discarded.
 */

import { IN_FLIGHT_MAX_AGE_MS } from './in-flight-fifo';

/**
 * Window during which a HAR entry that arrived before its matching
 * `onBeforeRequest` is held in {@link HarWaitingBuffer}, measured from
 * the entry's own `startedDateTime`. The forward race is a small
 * intra-process reordering, so this stays tight.
 */
export const HAR_FORWARD_HOLD_MS = 5_000;

/**
 * Window during which a finalized lifecycle is retained in
 * {@link FinalizedRetention} (and thus `recentLifecycles`) so a late HAR
 * can still attach, measured from the terminal-phase timestamp.
 *
 * Pinned to {@link IN_FLIGHT_MAX_AGE_MS} to enforce the attach invariant:
 * a request finishes no earlier than it starts, so retaining the
 * lifecycle for the same duration *from finish* always outlives the
 * in-flight join key's expiry *from start*. Whenever `popMatching` can
 * resolve a HAR, the lifecycle it resolves to still exists.
 */
export const FINALIZED_RETENTION_MS = IN_FLIGHT_MAX_AGE_MS;

/**
 * Per-tab cap on HAR entries held while waiting for their matching
 * `onBeforeRequest`. The forward race is rare in practice — held sets
 * are usually empty — but a misbehaving HAR pipeline (or a tab with no
 * webRequest traffic but lots of HAR) shouldn't be able to balloon
 * memory. LRU eviction drops the oldest held entry.
 */
export const MAX_HAR_WAITING_PER_TAB = 1_000;
