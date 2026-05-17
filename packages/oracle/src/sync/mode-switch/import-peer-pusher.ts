/**
 * Mode-switch Import (M4) — host-coupled peer-pusher registry.
 *
 * The Import orchestrator collects locally then needs to ship the
 * payload to the PEER host. Same registry pattern as
 * {@link setCoexistPeerPusher} — kept as a separate slot (rather than
 * generalizing to a multi-channel registry) so adding a third mode-
 * switch arm in the future doesn't compound coupling between unrelated
 * channels and so tests can install/clear each channel independently.
 *
 * Pattern: each host calls {@link setImportPeerPusher} at boot to
 * install its own pusher; absent registration ⇒ orchestrator returns
 * `peer-write-unavailable`.
 */

import type { ImportPayload, ImportResult } from '@openheaders/core/sync';

/**
 * Pushes a payload to the peer host and returns the peer's response.
 * Rejections are caught by the orchestrator and reported as
 * `peer-write-unavailable`. Implementations MUST NOT swallow errors —
 * the orchestrator distinguishes "transport failed" from "peer rejected
 * the apply" only by looking at the resolved result vs. a rejection.
 */
export type ImportPeerPusher = (payload: ImportPayload) => Promise<ImportResult>;

let pusher: ImportPeerPusher | null = null;

/**
 * Install (or remove) the host's peer pusher. Called once at boot per
 * host that has a client transport. Passing `null` reverts to the
 * unavailable state — useful in tests and on shutdown.
 */
export function setImportPeerPusher(next: ImportPeerPusher | null): void {
  pusher = next;
}

/** Read the currently-installed pusher. `null` ⇒ host can't reach its peer. */
export function getImportPeerPusher(): ImportPeerPusher | null {
  return pusher;
}
