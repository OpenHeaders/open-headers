/**
 * Live-value mutator catalog — routing constants.
 *
 * Singleton entity (per workspace). One LiveValue record holds a single
 * set-modeled map `values`, keyed by the run-key
 * `${workflowUid}:${environmentId ?? '__none__'}`. Each member is a
 * {@link LiveValueRecord} — the *value subset* of a workflow-run cache
 * row (`stepCaptures` + `extractedAt` + `expiresAt`).
 *
 * This is the WS-C C6 propagation seam: the desktop (and every host)
 * runner writes the resolved value as a §4 mutation here instead of a
 * host-local cache write, so the value rides the same bus that already
 * moves rules / definitions / OAuth bundles over the WS the browsers
 * are connected to. Host-local *runner* bookkeeping (circuit, failure
 * counters, response bytes, definitional-staleness) never enters this
 * entity — it stays in the `oh.ws.<id>.liveCache` blob each host
 * derives for itself.
 *
 * Sensitivity: a resolved capture set can hold an access token (a
 * derived secret), so the entity is schema-marked sensitive — stripped
 * from snapshots that cross a trust-zone boundary (§12.3). It still
 * converges across same-machine paired-loopback surfaces, which is the
 * whole point of C6.
 *
 * Side-effects: none routed through the §4 side-effect dispatcher.
 * Consumers light up via the existing `onLiveCacheStoreChange` path —
 * the live-layer bridge merges this entity's projection into the
 * `liveCache` blob and fires that notify, which already drives the
 * resolver mirror + DNR recompile.
 */

/** Routing key carried on every live-value mutation envelope. */
export const LIVE_VALUE_ENTITY_TYPE = 'live-value';

/** Fixed singleton id — every workspace has exactly one of these. */
export const LIVE_VALUE_ID = 'live-value';

/** Set path holding {@link LiveValueRecord} members keyed by run-key. */
export const LIVE_VALUE_VALUES_PATH = 'values';
