/**
 * Valibot schema for `V5.Collection` — the folder that holds rules
 * or requests + collection-scoped variables.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { VariableSchema } from './variable';

export const CollectionSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /**
   * Phase 10 monotonic write counter — separate from `schemaVersion`.
   * Starts at 1 on creation, incremented by the owning store on every
   * save. Editors (CollectionVariablesEditor) send the loaded counter
   * back as `expectedVersion` on save to detect concurrent cross-tab
   * writes. V5 has zero users, so required from day one.
   */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  description: v.optional(v.string()),
  variables: v.array(VariableSchema),
  // Explicit child ordering — list of child folder names ("<slug>-<uid>").
  // Absent = alphabetical. See Phase 0 invariant #10.
  order: v.optional(v.array(v.string())),
  pinnedEnvironmentIds: v.optional(v.array(UidSchema), []),
  defaultEnvironmentId: v.optional(v.nullable(UidSchema), null),
});

/**
 * On-disk `_folder.yaml` — the lightweight grouping folder inside a
 * collection. Does not carry variables (collection is the only
 * variable-scoping folder type per the 4-scope model). `path` is
 * populated by the caller at parse time; not written to YAML. See
 * Phase 0 invariants #10 (order) + #11 (rules live in collections).
 */
export const FolderSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /**
   * Phase 10 monotonic write counter — rename / delete operations bump
   * this so a renaming race between two tabs is deterministic (one
   * winner, the serialized order survives). No editor attaches to a
   * folder today, so stale-draft detection is not used, but callers
   * that want it can pass `expectedVersion` through the store.
   */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  order: v.optional(v.array(v.string())),
});
