/**
 * Mode-switch Coexist (M3) — source-side orchestrator.
 *
 * Glues {@link collectCoexistPayload} (local) to the host-installed
 * peer pusher (host-specific transport). The orchestrator owns the
 * three sequencing decisions that don't belong in either half:
 *
 *   1. No pusher installed → `peer-write-unavailable` (skip collection
 *      entirely; the user gets a clean "use Discard with backup"
 *      fallback without any side effects).
 *   2. Local has no user content → `no-source-data` (defensive — the
 *      dialog only mounts when source presence is non-empty, but a race
 *      could trim the source between gate and execute).
 *   3. Pusher rejected or the peer returned a failure → propagate
 *      (rejection → `peer-write-unavailable`; explicit `{ ok: false }`
 *      result from the peer → returned verbatim so the UI can
 *      distinguish a hung wire from a target-side apply failure).
 *
 * Host-neutral: extension SW + desktop main both call this through the
 * `oh.sync.executeCoexistToPeer` channel and get the right behavior
 * based on whether `setCoexistPeerPusher` was called at boot.
 */

import type { CoexistResult } from '@openheaders/core/sync';
import {
  collectCoexistPayload,
  type CollectCoexistPayloadInput,
} from './coexist-collector';
import { getCoexistPeerPusher } from './coexist-peer-pusher';

export type OrchestrateCoexistDeps = CollectCoexistPayloadInput;

export async function orchestrateCoexistToPeer(deps: OrchestrateCoexistDeps): Promise<CoexistResult> {
  const push = getCoexistPeerPusher();
  if (!push) {
    return { ok: false, reason: 'peer-write-unavailable', detail: 'no peer pusher installed' };
  }

  const payload = await collectCoexistPayload(deps);
  if (payload.workspaces.length === 0) {
    return { ok: false, reason: 'no-source-data' };
  }

  try {
    return await push(payload);
  } catch (err) {
    return {
      ok: false,
      reason: 'peer-write-unavailable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
