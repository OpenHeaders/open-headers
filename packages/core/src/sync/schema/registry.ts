/**
 * Entity schema registry — the schema-aware boundary that lets the
 * otherwise schema-blind core engine emit canonical materialized
 * shapes (§7 / §9).
 *
 * The state model in `mutators/state.ts` records *what happened*:
 * field writes, set adds, set tombstones. It has no notion of *what
 * should always exist*. A set-modeled field that was never touched
 * (zero `addToSet` ever applied) leaves no trace in `EntityState.setItems`,
 * so the materializer would naturally omit the path entirely. That
 * conflicts with the persisted-shape contract — `Vault.secrets`,
 * `WorkspaceVariables.variables`, `Rule.conditions`, etc. are
 * non-optional `T[]` per the valibot schemas; consumers iterate them
 * unconditionally.
 *
 * Industry pattern: schema is bound at the document/oracle level, not
 * carried per mutation. Yjs binds collection types to the document
 * shape at construction; Replicache / Linear declare list fields as
 * first-class structure; protobuf canonicalizes empty `repeated` to
 * `[]`. Same idea here, scoped to set paths so the engine stays
 * catalog-agnostic — it consumes an opaque `Map<EntityType, EntitySchema>`
 * configured by the consumer at oracle construction.
 *
 * The registry is purely additive at materialize time: declared paths
 * with no live entries surface as `[]`; undeclared paths follow the
 * existing "absent if untouched" rule. State writes never consult the
 * registry — convergence semantics are unchanged.
 */

import type { EntityType } from '../envelope';

/**
 * Per-entity-type schema metadata consumed by the materializer.
 *
 * `setPaths` lists every set-modeled dotted path on the entity (the
 * paths the entity's seed function emits `addToSet` against). At
 * materialize time, every listed path is guaranteed to surface — as
 * `[]` if no live entries exist, or as the ordered set otherwise.
 *
 * Paths that are conditional on an entity sub-shape (e.g. a Rule's
 * `action.requestHeaders` only exists for `type: 'header'`) should
 * be listed unconditionally; the materializer emits `[]` at the path
 * but downstream projections strip empty arrays at locations the
 * sub-shape doesn't expect.
 */
/**
 * Resolver for set-modeled paths on an entity. The static array form
 * suffices when every variant of the entity carries the same set
 * paths (e.g. `Vault.secrets` is always present). The function form
 * handles entities where set paths depend on a discriminant field —
 * `Rule` is the canonical case: `action.requestHeaders` /
 * `action.responseHeaders` exist only on `type: 'header'`. The
 * resolver receives the entity's field-value-only partial materialized
 * data so it can branch on the discriminant.
 */
export type SetPathsResolver =
  | readonly string[]
  | ((partial: unknown) => readonly string[]);

export interface EntitySchema {
  readonly setPaths: SetPathsResolver;
}

/**
 * Opaque registry passed to {@link InMemoryDocumentStore} /
 * {@link EntityOracle} at construction. Maps `EntityType` →
 * {@link EntitySchema}. Entries are looked up by exact `EntityType`
 * string match; types absent from the registry get the legacy
 * "untouched paths are absent" behaviour.
 */
export type EntitySchemaRegistry = ReadonlyMap<EntityType, EntitySchema>;

/** Empty registry — default for tests and ad-hoc stores that don't
 *  care about empty-set canonicalization. */
export const EMPTY_ENTITY_SCHEMA_REGISTRY: EntitySchemaRegistry = new Map();
