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
 * Pinned to {@link IN_FLIGHT_MAX_AGE_MS} so the lifecycle stays
 * attachable for the same span the join key stays poppable. The two
 * clocks differ — the join key ages off HAR/same-URL timestamps, this
 * retention off real-time event ticks — so the match isn't a hard
 * invariant; but measuring retention *from finish* (which is never
 * before start) means any HAR delivered within roughly this window past
 * `onCompleted` still finds its lifecycle. That covers the realistic
 * slow/offline delivery lag that previously dropped late HAR; lag beyond
 * the window remains best-effort.
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
