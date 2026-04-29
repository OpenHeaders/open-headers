/**
 * Mutator framing.
 *
 * Mutators are pure functions. Given current per-entity state and an
 * inbound envelope, they emit a {@link MutatorOutcome}: either an
 * authoritative state delta (with optional side-effect intents — §18.1)
 * or a structured no-op / rejection.
 *
 * The document store consumes outcomes; mutators never read or write
 * the store directly.
 */

import type { EntityType } from '../envelope';
import type { HLC } from '../hlc';

/**
 * Imperative intent describing work the side-effect runner must do
 * after the snapshot commits. Coalesced by the runner via
 * `(kind, key)` — latest HLC wins (§ side-effect runner). Intents are
 * persisted to IDB alongside the mutation log so SW eviction is
 * survivable; runner reads the materialized snapshot at execution
 * time, not at enqueue time.
 */
export interface SideEffectIntent {
  kind: string;
  key: string;
  hlc: HLC;
  /** Opaque payload for the runner; entity-specific. */
  payload?: unknown;
}

export type MutatorStatus =
  | 'applied'
  | 'duplicate'
  | 'superseded-by-hlc'
  | 'tombstoned'
  | 'concurrent-create-with-tombstone'
  | 'invalid-path'
  | 'schema-rejected'
  | 'unknown-mutator-version';

export interface MutatorOutcome {
  status: MutatorStatus;
  /** Side-effect intents to enqueue if status === 'applied'. */
  sideEffects?: SideEffectIntent[];
  /** Human-readable detail surfaced to telemetry / observability. */
  detail?: string;
}

/**
 * Per-entity state passed to mutators. Internal to the sync engine —
 * not persisted in this shape (the persistence backend stores
 * materialized snapshots; the log stores envelopes).
 */
export interface EntityState {
  type: EntityType;
  id: string;
  /** Tombstone HLC if this entity has been deleted. Permanent under v1 (§7.2). */
  tombstone: HLC | null;
  /** Per-path field values; max-HLC-wins. Path is a dotted string (§7.3). */
  fieldValues: Map<string, { value: unknown; hlc: HLC }>;
  /** Per-path field tombstones; max-HLC-wins. */
  fieldTombstones: Map<string, HLC>;
  /** Per-(setPath, itemId) add records; max-HLC-wins. */
  setItems: Map<string, Map<string, { item: unknown; addHlc: HLC }>>;
  /** Per-(setPath, itemId) remove tombstones; max-HLC-wins. */
  setTombstones: Map<string, Map<string, HLC>>;
  /**
   * Per-(setPath, itemId) fractional-indexing order keys. Updated by
   * `moveBefore`; seeded by `addToSet` so newly-added items have a
   * deterministic position even before any explicit move. LWW by HLC.
   * Materialization sorts live set items by `key`, with itemId as the
   * tie-breaker so concurrent mints of the same key still converge.
   */
  setOrder: Map<string, Map<string, { key: string; hlc: HLC }>>;
}

/**
 * Per-batch context the local oracle stamps onto every envelope a
 * factory mints. Identical across entity types — Rule, Environment,
 * future Collection / Folder — because the wire envelope is generic
 * and authorship metadata doesn't vary per entity. Surfaces fill these
 * in once and pass through.
 */
export interface MutatorContext {
  workspaceId: string;
  hlc: HLC;
  surfaceId: string;
  deviceId: string;
  /**
   * Optional: when supplied, every envelope in the resulting batch
   * shares this batchId. Otherwise a fresh one is minted per factory
   * call. UI gestures that emit multiple intents in one tick (e.g.
   * "delete header mod" → remove + recompile, "rename env var" →
   * remove + add) should pass an explicit batchId so the oracle treats
   * them all-or-nothing.
   */
  batchId?: string;
  userId?: string;
}

/**
 * The factory return shape — a batch plus side-effect intents to
 * enqueue once the batch commits. Identical across entity types; the
 * oracle coalesces side-effects by `(kind, key)` per §18.1.
 */
export interface MutatorIntent {
  batch: import('../envelope').MutationBatch;
  sideEffects: SideEffectIntent[];
}
