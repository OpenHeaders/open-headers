import type { HLC } from '../hlc';

/**
 * Per-`nodeId` maximum HLC seen by a local oracle.
 *
 * Keyed by the HLC `nodeId` (writer identity — extension SW process,
 * desktop main process, daemon instance) and NOT by the device-id in
 * the mutation envelope's origin. Two writers on the same physical
 * device produce two `nodeId` entries.
 *
 * Used in two places:
 *
 * 1. **Handshake** — peers exchange vectors to compute each other's
 *    missing-mutations set without enumerating histories. See
 *    `docs/DATA_PLANE_TOPOLOGIES.md` §11.1.
 * 2. **Watermark bookkeeping** — a node persists its peer's `SYNCED`
 *    vector so reconnect can resume from there without rescanning the
 *    whole log.
 *
 * Empty vector = cold oracle; the peer treats this as the snapshot-
 * bootstrap signal when its own history is non-trivial (C5/C6).
 */
export type StateVector = Record<string, HLC>;
