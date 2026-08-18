/**
 * Pending-out queue — Phase C C13/C14.
 *
 * Persists envelopes the local host could not deliver to a remote
 * peer (WS disconnected, peer not handshook yet, transport error)
 * so a reconnect-flush (C15) can replay them in HLC order.
 *
 * Per the phase-C/D status log: keyed per-remote so a single host
 * can maintain independent queues against multiple peers (e.g. a
 * future setup with both a localhost desktop and a LAN daemon).
 * Until Phase D, there's exactly one remote — the backend WS — and
 * the implementation just uses the constant {@link DEFAULT_REMOTE_ID}.
 *
 * Two implementations, same contract:
 *
 *   - {@link InMemoryPendingOutQueue} — for tests + cold-start before
 *     IDB resolves.
 *   - `IdbPendingOutQueue` (separate file) — production storage for
 *     the extension SW. Desktop main gets a SQLite implementation
 *     later under C14.
 *
 * The queue is append-only by HLC: drain reads oldest-first. Removal
 * happens after a successful flush ack (which today means "send
 * returned `true` and the local seen-set has the mutationId"). Items
 * not ack'd survive into the next drain — at-least-once delivery
 * paired with the receive-side dedup gives the convergence property.
 */

import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';

export const DEFAULT_REMOTE_ID = 'backend';

export interface PendingOutQueue {
  /** Append one envelope. Idempotent — duplicate `mutationId` is a no-op. */
  enqueue(remoteId: string, env: MutationEnvelope): Promise<void>;

  /**
   * Iterate every pending envelope for `remoteId` in HLC ascending
   * order. The result is a snapshot at call time; concurrent
   * `enqueue` calls AFTER iteration begins won't appear in this
   * pass and surface on the next drain.
   */
  drain(remoteId: string): AsyncIterable<MutationEnvelope>;

  /** Remove one envelope (typically after successful peer ack / send). */
  ack(remoteId: string, mutationId: string): Promise<void>;

  /** Bulk variant of {@link ack}; single transaction on backends that support it. */
  ackAll(remoteId: string, mutationIds: readonly string[]): Promise<void>;

  /** True if the envelope is in the queue. Used by tests and dedup. */
  has(remoteId: string, mutationId: string): Promise<boolean>;

  /** Live count for `remoteId` — observability + status pill. */
  size(remoteId: string): Promise<number>;
}

export class InMemoryPendingOutQueue implements PendingOutQueue {
  private readonly buckets = new Map<string, Map<string, MutationEnvelope>>();

  private bucket(remoteId: string): Map<string, MutationEnvelope> {
    let b = this.buckets.get(remoteId);
    if (!b) {
      b = new Map();
      this.buckets.set(remoteId, b);
    }
    return b;
  }

  async enqueue(remoteId: string, env: MutationEnvelope): Promise<void> {
    const b = this.bucket(remoteId);
    if (b.has(env.mutationId)) return;
    b.set(env.mutationId, env);
  }

  async *drain(remoteId: string): AsyncIterable<MutationEnvelope> {
    const b = this.buckets.get(remoteId);
    if (!b) return;
    const ordered = [...b.values()].sort((a, c) => {
      const ka = hlcToString(a.hlc);
      const kc = hlcToString(c.hlc);
      return ka < kc ? -1 : ka > kc ? 1 : 0;
    });
    for (const env of ordered) yield env;
  }

  async ack(remoteId: string, mutationId: string): Promise<void> {
    const b = this.buckets.get(remoteId);
    if (!b) return;
    b.delete(mutationId);
  }

  async ackAll(remoteId: string, mutationIds: readonly string[]): Promise<void> {
    const b = this.buckets.get(remoteId);
    if (!b) return;
    for (const id of mutationIds) b.delete(id);
  }

  async has(remoteId: string, mutationId: string): Promise<boolean> {
    return Boolean(this.buckets.get(remoteId)?.has(mutationId));
  }

  async size(remoteId: string): Promise<number> {
    return this.buckets.get(remoteId)?.size ?? 0;
  }
}
