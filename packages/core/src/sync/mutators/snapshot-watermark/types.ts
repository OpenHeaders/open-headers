/**
 * Snapshot-watermark mutator catalog — routing constants.
 *
 * A host that bootstraps a workspace from a peer's snapshot holds the
 * peer's state as of the snapshot's `takenAtHlc` vector without holding
 * the rows that produced it: the applier re-materializes the post-state
 * as fresh local commits under this host's own node. The host's log
 * alone would therefore fold to a vector that never covers the peer's
 * nodes, the peer would count every one of its rows as missing on every
 * later catch-up, and past the snapshot threshold it would answer with
 * a snapshot again — a re-mint of the whole workspace on every join.
 *
 * The watermark is the logged fact that closes that loop: one
 * host-local singleton per workspace scope whose `setField` carries the
 * vector the snapshot covered. The state-vector reader unions it with
 * the fold of the rows, so the next STATE_VECTOR this host presents
 * covers the peer's nodes up to the snapshot and the peer streams only
 * the true delta above it. The log stays the single source of truth —
 * the vector is derived from logged rows, never from a side record —
 * and a workspace purge drops the watermark with the rest of its rows,
 * so a re-joined peer is cold again and bootstraps afresh.
 *
 * Never on any wire in either direction (`HOST_LOCAL_ENTITY_TYPES`):
 * what a host has seen of a peer is that host's own bookkeeping. No
 * projection, no cache, no snapshot array — the row is read by the
 * state-vector fold alone. Not sensitive. No side effects.
 */

/** Routing key carried on every snapshot-watermark mutation envelope. */
export const SNAPSHOT_WATERMARK_ENTITY_TYPE = 'snapshot-watermark';

/** Fixed singleton id — one watermark per workspace scope per host. */
export const SNAPSHOT_WATERMARK_ID = 'snapshot-watermark';

/** Field path holding the covered `StateVector` on the singleton. */
export const SNAPSHOT_WATERMARK_PATH = 'vector';
