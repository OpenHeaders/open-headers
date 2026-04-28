/**
 * Sync transport — how mutations move between persistence backends
 * (§10.2). Each device may run zero or more transports against the
 * same persistence backend; the local oracle multiplexes them.
 */

import type { MutationEnvelope } from '../envelope';
import type { HLC } from '../hlc';
import type { MaterializedEntity } from '../store';

export interface TransportCaps {
  /** True if the transport can deliver mutations as soon as they're committed. */
  realtime: boolean;
  /** True if the transport runs on a wall-clock schedule (Git scheduled push, S3 polling). */
  scheduled: boolean;
  /** True if the transport only acts on user-initiated calls (manual `git push`). */
  onDemand: boolean;
}

export interface RejectionReason {
  mutationId: string;
  reason: string;
  detail?: string;
}

export interface PushResult {
  accepted: HLC[];
  rejected: RejectionReason[];
}

export type TransportEvent =
  | { kind: 'mutation'; envelope: MutationEnvelope }
  | { kind: 'snapshot-delta'; entity: MaterializedEntity };

export interface SyncTransport {
  pushMutations(muts: MutationEnvelope[]): Promise<PushResult>;
  pullChanges(sinceHlc?: HLC): AsyncIterable<TransportEvent>;
  isReadOnly(): boolean;
  capabilities(): TransportCaps;
}
