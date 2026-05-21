/**
 * Outbound transport gate — the single authority deciding whether a
 * locally-committed envelope may cross the wire toward the backend.
 *
 * Sender-side sibling of `mutation-stream-bridge.ts` (which owns the
 * receiver-side org filter). Every outbound path funnels through
 * {@link evaluateOutboundEnvelope} — the live forwarder, the reconnect
 * pending-out flush, and (Phase U6.3+) the handshake state-vector fold —
 * so the three eligibility layers live in exactly one place:
 *
 *   1. **Echo guard (C11)** — host-coupled: pairs with the host's
 *      inbound-receiver seen-set, so the predicate is injected by host
 *      boot ({@link setOutboundEchoGuard}). An envelope this host just
 *      received from the backend must not bounce straight back.
 *   2. **Tenancy (Phase U6.2)** — only envelopes stamped with a
 *      *consumed* Org go up (`consumedOrgIds` — a joined backend's Org,
 *      never the identity's own home Org). A consume-only join never
 *      pushes the joiner's own data to the backend; the receiver-side
 *      filter on the backend stays as the security backstop.
 *   3. **Authorization (Phase U2.3)** — the local user must hold
 *      `workspace.write` on the envelope's workspace. The decision is
 *      audited: a denial here is a privilege failure, not a routing
 *      decision, and belongs in the forensic record.
 *
 * The layers run cheapest-first (echo needs no snapshot; tenancy and
 * authz share one). A drop short-circuits — an envelope withheld by
 * tenancy never reaches the authz check, so no audit entry is minted for
 * a check that never ran.
 */

import { consumedOrgIds, emitAuditEntry, getIdentitySnapshot, hasCapability } from '@openheaders/core/identity';
import type { MutationEnvelope } from '@openheaders/core/sync';

/** Which layer withheld the envelope — drives caller logging + queue handling. */
export type OutboundDropLayer = 'echo' | 'tenancy' | 'authz';

export type OutboundVerdict =
  | { readonly allow: true }
  | { readonly allow: false; readonly layer: OutboundDropLayer; readonly reason?: string };

/**
 * Predicate identifying an envelope this host received from the backend
 * (so re-sending it would echo). Host-coupled because it reads the
 * host's own inbound-receiver seen-set; the extension SW wires its
 * receiver's `hasRecentlyApplied` here at boot. Defaults to "never an
 * echo" so an unwired gate (cold boot, test harness) doesn't withhold
 * everything.
 */
let isWireEcho: (mutationId: string) => boolean = () => false;

/** Install the echo predicate. Called once by host boot wiring. */
export function setOutboundEchoGuard(predicate: (mutationId: string) => boolean): void {
  isWireEcho = predicate;
}

/**
 * Decide whether `envelope` may be sent to the backend. Pure of
 * transport — the caller sends, enqueues, or ack-drops based on the
 * verdict. The authz layer emits an audit entry as a side effect; the
 * echo + tenancy layers are silent (routing decisions, not denials).
 */
export function evaluateOutboundEnvelope(envelope: MutationEnvelope): OutboundVerdict {
  if (isWireEcho(envelope.mutationId)) {
    return { allow: false, layer: 'echo' };
  }

  const snapshot = getIdentitySnapshot();
  if (!consumedOrgIds(snapshot).has(envelope.orgId)) {
    return { allow: false, layer: 'tenancy', reason: `orgId ${envelope.orgId} is not a consumed Org` };
  }

  const decision = hasCapability(snapshot, 'workspace.write', { workspaceId: envelope.workspaceId });
  emitAuditEntry({
    actorUserId: snapshot?.user.id ?? 'unknown',
    capability: 'workspace.write',
    workspaceId: envelope.workspaceId,
    decision,
  });
  if (!decision.allow) {
    return { allow: false, layer: 'authz', reason: decision.reason };
  }

  return { allow: true };
}

/** Test-only — restore the default (no-op) echo guard between cases. */
export function __resetOutboundGateForTests(): void {
  isWireEcho = () => false;
}
