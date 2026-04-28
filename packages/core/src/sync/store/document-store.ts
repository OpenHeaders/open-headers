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
import { liveOrderedItemsAt, newEntityState } from '../mutators/state';
import type { EntityState, MutatorOutcome } from '../mutators/types';
import { canonicalJson } from './canonical';
import { type MaterializedEntity, materializeEntity } from './materialize';

const entityKey = (type: EntityType, id: string): string => `${type}:${id}`;

/**
 * Opaque snapshot of the store's mutable state. Returned by
 * {@link InMemoryDocumentStore.snapshot} and consumed by
 * {@link InMemoryDocumentStore.restore} — purpose-built for the
 * oracle's per-batch rollback (§11.2). Treat as a black box.
 */
export interface DocumentStoreSnapshot {
  readonly entities: Map<string, EntityState>;
  readonly appliedMutationIds: Set<string>;
}

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

  /**
   * Live members of a set at `(type, id, setPath)`, sorted by order key
   * (with itemId tie-break). Surfaces this for write-side helpers that
   * need to enumerate current itemIds — e.g. a partial-update flow that
   * replaces a set's contents must emit `removeFromSet` for every live
   * itemId before adding fresh members. Returns `[]` when the entity
   * doesn't exist or the set is empty.
   */
  liveSetItems(type: EntityType, id: string, setPath: string): Array<{ itemId: string; item: unknown }> {
    const state = this.entities.get(entityKey(type, id));
    if (!state) return [];
    return liveOrderedItemsAt(state, setPath).map(({ itemId, item }) => ({ itemId, item }));
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

  /**
   * Capture a deep clone of internal state. Paired with
   * {@link restore} to give the local oracle per-batch rollback
   * (§11.2 all-or-nothing) without exposing field-level access.
   */
  snapshot(): DocumentStoreSnapshot {
    const entities = new Map<string, EntityState>();
    for (const [k, state] of this.entities) entities.set(k, cloneEntityState(state));
    return { entities, appliedMutationIds: new Set(this.appliedMutationIds) };
  }

  /** Restore previously-{@link snapshot snapshot}ed state in place. */
  restore(snap: DocumentStoreSnapshot): void {
    this.entities.clear();
    for (const [k, state] of snap.entities) this.entities.set(k, cloneEntityState(state));
    this.appliedMutationIds.clear();
    for (const id of snap.appliedMutationIds) this.appliedMutationIds.add(id);
  }
}

function cloneEntityState(state: EntityState): EntityState {
  return {
    type: state.type,
    id: state.id,
    tombstone: state.tombstone,
    fieldValues: new Map(state.fieldValues),
    fieldTombstones: new Map(state.fieldTombstones),
    setItems: cloneNestedMap(state.setItems),
    setTombstones: cloneNestedMap(state.setTombstones),
    setOrder: cloneNestedMap(state.setOrder),
  };
}

function cloneNestedMap<V>(map: Map<string, Map<string, V>>): Map<string, Map<string, V>> {
  const out = new Map<string, Map<string, V>>();
  for (const [k, inner] of map) out.set(k, new Map(inner));
  return out;
}
