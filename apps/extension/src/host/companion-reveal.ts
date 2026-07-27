/**
 * `companionReveal` capability implementation — shared by the standard
 * capability install (`install-capabilities.ts`, popup / panel /
 * sidepanel) and the workbench's curated entry, which skips that
 * module for its popup-only RPCs and must register this one itself.
 *
 * Relays through the SW's `companionReveal` bridge RPC, which forwards
 * the target to the connected desktop app as a peer RPC on the
 * loopback wire. Shared UI gates the affordance on LIVE connection
 * state; a dropped wire mid-click resolves an honest `{ ok: false }`
 * instead of throwing.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { CompanionRevealTarget } from '@openheaders/core/protocol';

export function companionReveal(target: CompanionRevealTarget): Promise<{ ok: boolean; reason?: string }> {
  return hostBridge
    .call('companionReveal', { target })
    .then((resp) => ({ ok: resp.ok, ...(resp.reason !== undefined ? { reason: resp.reason } : {}) }))
    .catch((err: Error) => ({ ok: false, reason: err.message }));
}
