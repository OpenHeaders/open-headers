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
 * Reorder primitive — fractional indexing on the **parent's** order array.
 * `beforeItemId === null` means "move to the end" (per §7.2).
 */
export interface MoveBeforeMutation {
  kind: 'moveBefore';
  type: EntityType;
  id: string;
  path: string;
  itemId: string;
  beforeItemId: string | null;
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
