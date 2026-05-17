/**
 * Mode-switch Coexist (M3) — host-coupled peer-pusher registry.
 *
 * The Coexist orchestrator collects locally then needs to ship the
 * payload to the PEER host. The wire transport is host-specific
 * (extension SW has `wsRequest`; desktop main has no client transport
 * yet) so the orchestrator can't import either directly without
 * dragging a chrome/electron coupling into oracle.
 *
 * Pattern follows the activity-log / activity-mute-store registries:
 * each host calls {@link setCoexistPeerPusher} at boot to install its
 * own pusher; absent registration ⇒ orchestrator returns
 * `peer-write-unavailable`.
 */

import type { CoexistPayload, CoexistResult } from '@openheaders/core/sync';

/**
 * Pushes a payload to the peer host and returns the peer's response.
 * Rejections are caught by the orchestrator and reported as
 * `peer-write-unavailable`. Implementations MUST NOT swallow errors —
 * the orchestrator distinguishes "transport failed" from "peer rejected
 * the apply" only by looking at the resolved result vs. a rejection.
 */
export type CoexistPeerPusher = (payload: CoexistPayload) => Promise<CoexistResult>;

let pusher: CoexistPeerPusher | null = null;

/**
 * Install (or remove) the host's peer pusher. Called once at boot per
 * host that has a client transport. Passing `null` reverts to the
 * unavailable state — useful in tests and on shutdown.
 */
export function setCoexistPeerPusher(next: CoexistPeerPusher | null): void {
  pusher = next;
}

/** Read the currently-installed pusher. `null` ⇒ host can't reach its peer. */
export function getCoexistPeerPusher(): CoexistPeerPusher | null {
  return pusher;
}
