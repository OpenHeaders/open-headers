/**
 * Mutation broadcast bus (Phase A R3).
 *
 * The local oracle ships every committed `(MutationEnvelope, status)`
 * tuple back to every surface so the originator's optimistic apply
 * can dedup and other surfaces can replay. The {@link MutationBroadcast}
 * interface keeps oracle logic decoupled from the chrome.runtime
 * messaging plumbing — vitest uses the in-memory fan-out below; the
 * production wiring (R4 — bridge RPC) plugs in a chrome.runtime impl.
 */

import type { FieldOrigin, MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';

export interface BroadcastEvent {
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  /** Set when this event corresponds to a batch — surfaces use it for ack-by-batch. */
  batchId?: string;
  /**
   * Provenance of the apply that committed this envelope. `'inbound'`
   * marks peer-sourced content (mutation-stream bridge, snapshot
   * bootstrap re-seed); forwarders use it to decide direction: client
   * hosts never send inbound content back up the wire, the hub host
   * relays it to its other peers.
   */
  applyOrigin?: FieldOrigin;
}

export interface MutationBroadcast {
  publish(event: BroadcastEvent): void;
}

/**
 * Test/seed in-memory fan-out. Production replaces this with a
 * chrome.runtime port-based implementation in R4.
 */
export class InMemoryBroadcast implements MutationBroadcast {
  private readonly listeners = new Set<(e: BroadcastEvent) => void>();

  publish(event: BroadcastEvent): void {
    for (const l of this.listeners) l(event);
  }

  subscribe(listener: (e: BroadcastEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
