/**
 * Mutation envelope shapes — the wire format every node speaks.
 *
 * Mutations are entity-typed by an opaque {@link EntityType} string so
 * the core sync engine stays decoupled from the entity catalogue
 * (Rule, Environment, …). Entity-specific schemas validate
 * {@link CreateMutation.payload} and {@link SetFieldMutation.value}
 * at the boundary; nothing inside `core/sync` introspects them.
 */
import type { HLC } from '../hlc';

/** Routing key. Concrete catalogue (e.g. `'rule' | 'environment'`) lives outside core/sync. */
export type EntityType = string;

/** Whole-entity create. Idempotent by `(type, id)`; tombstone wins absolutely. */
export interface CreateMutation {
  kind: 'create';
  type: EntityType;
  id: string;
  /** Validated by the entity-specific schema at the oracle boundary. */
  payload: unknown;
}

/** Whole-entity delete. Tombstone retained for the configured TTL window. */
export interface DeleteMutation {
  kind: 'delete';
  type: EntityType;
  id: string;
}

/** LWW-by-HLC at a typed dotted path. */
export interface SetFieldMutation {
  kind: 'setField';
  type: EntityType;
  id: string;
  path: string;
  value: unknown;
}

/** Removes a path from the entity. Behaves like LWW on absence. */
export interface UnsetFieldMutation {
  kind: 'unsetField';
  type: EntityType;
  id: string;
  path: string;
}

/** Set add with HLC-tagged tombstones at `path` (an array-of-keyed-items). */
export interface AddToSetMutation {
  kind: 'addToSet';
  type: EntityType;
  id: string;
  path: string;
  itemId: string;
  item: unknown;
  /**
   * Optional initial fractional-indexing key for parent-owned ordering
   * (§7.2 / §23.5). Convergence requires the writer to commit to a key
   * at emit time — relative anchors aren't replay-stable. When absent,
   * the seed key is used; itemId tie-breaks the materialized order so
   * "naked" set-adds still converge.
   */
  orderKey?: string;
}

/** Tombstone-set remove. */
export interface RemoveFromSetMutation {
  kind: 'removeFromSet';
  type: EntityType;
  id: string;
  path: string;
  itemId: string;
}

/**
 * Reorder primitive — fractional indexing on the **parent's** order
 * array (§7.2 / §23.5). The envelope carries the new `orderKey`
 * directly: the writer computes it from its local view via
 * `keyBetween(predecessorKey, anchorKey)` at emit time. This is what
 * makes replay convergent — relative anchors (`beforeItemId`) would
 * resolve to different keys depending on apply order.
 */
export interface MoveBeforeMutation {
  kind: 'moveBefore';
  type: EntityType;
  id: string;
  path: string;
  itemId: string;
  orderKey: string;
}

export type MutationBody =
  | CreateMutation
  | DeleteMutation
  | SetFieldMutation
  | UnsetFieldMutation
  | AddToSetMutation
  | RemoveFromSetMutation
  | MoveBeforeMutation;

export type MutationKind = MutationBody['kind'];

export interface MutationOrigin {
  surfaceId: string;
  deviceId: string;
  /** Populated in Phase D once team-mode userId flows through. */
  userId?: string;
}

export interface MutationEnvelope {
  mutationId: string;
  hlc: HLC;
  origin: MutationOrigin;
  workspaceId: string;
  /**
   * Org binding stamped at mint time from the workspace's `orgId`
   * (the unified-oracle model §6.1, §8.2). Denormalized onto every
   * mutation log row so transports filter by `org_id IN (authorized
   * set)` without joining back to the workspace table. Never rewritten
   * when the workspace's binding flips — historical envelopes carry
   * historical Org context.
   */
  orgId: string;
  /** Per-mutator-kind schema version (§13.4). */
  mutatorVersion: number;
  body: MutationBody;
}

/**
 * Multiple mutations bundled by a single user gesture. The local oracle
 * applies a batch all-or-nothing (§11.2); a failed constituent rolls
 * back the whole batch and surfaces a structured error.
 */
export interface MutationBatch {
  batchId: string;
  mutations: MutationEnvelope[];
}
