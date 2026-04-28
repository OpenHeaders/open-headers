/**
 * In-memory document store — the reference implementation of the
 * local oracle's apply path. Holds per-entity state, dedup set, and
 * exposes `apply()` and `materialize()`.
 *
 * Intentional non-features in this layer:
 *   - persistence (delegated to {@link PersistenceBackend})
 *   - lock acquisition (the caller — local oracle or property test
 *     harness — holds the per-entity lock)
 *   - broadcast (oracle responsibility)
 *
 * That separation is what makes this class swappable into both the
 * production oracle and the property-test harness without changes.
 */

import type { EntityType, MutationEnvelope } from '../envelope';
import { applyMutation } from '../mutators';
import { newEntityState } from '../mutators/state';
import type { EntityState, MutatorOutcome } from '../mutators/types';
import { canonicalJson } from './canonical';
import { type MaterializedEntity, materializeEntity } from './materialize';

const entityKey = (type: EntityType, id: string): string => `${type}:${id}`;

export class InMemoryDocumentStore {
  private readonly entities = new Map<string, EntityState>();
  private readonly appliedMutationIds = new Set<string>();

  apply(envelope: MutationEnvelope): MutatorOutcome {
    if (this.appliedMutationIds.has(envelope.mutationId)) {
      return { status: 'duplicate' };
    }

    const key = entityKey(envelope.body.type, envelope.body.id);
    let state = this.entities.get(key);
    if (!state) {
      state = newEntityState(envelope.body.type, envelope.body.id);
      this.entities.set(key, state);
    }

    const outcome = applyMutation(state, envelope);
    this.appliedMutationIds.add(envelope.mutationId);
    return outcome;
  }

  /** True if a mutationId has already been seen (dedup query for transports). */
  hasMutation(mutationId: string): boolean {
    return this.appliedMutationIds.has(mutationId);
  }

  /** Materialized, deletion-filtered snapshot list, sorted by (type, id). */
  materializeAll(): MaterializedEntity[] {
    const out: MaterializedEntity[] = [];
    for (const state of this.entities.values()) {
      const m = materializeEntity(state);
      if (m) out.push(m);
    }
    out.sort((a, b) => {
      if (a.type !== b.type) return a.type < b.type ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }

  /**
   * Canonical JSON of the full materialized snapshot. Two stores that
   * applied the same mutation set in different orders must agree on
   * this string — that's the property-test invariant.
   */
  canonicalSnapshot(): string {
    return canonicalJson(this.materializeAll());
  }
}
