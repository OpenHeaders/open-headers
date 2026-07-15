/**
 * Valibot schema for `Collection` — the folder that holds rules
 * or requests + collection-scoped variables.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { AuthConfigSchema } from './request';
import { VariableSchema } from './variable';

export const CollectionSchema = v.object({
  schemaVersion: SchemaVersionSchema,
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
  /**
   * Ancestor script slots — meaningful under request-collection
   * routing only (rule collections share this schema but no rule
   * surface sets or executes them). A request's send composes scripts
   * ancestor-first: collection pre → folder pre → request pre, and the
   * same order post-response. Persisted as `pre-request.js` /
   * `post-response.js` sibling files beside `_collection.yaml`
   * (invariant #9, two-file scripts), never inline in the YAML.
   */
  preRequestScript: v.optional(v.string()),
  postResponseScript: v.optional(v.string()),
  /**
   * Ancestor default auth — meaningful under request-collection
   * routing only, like the script slots. A request whose auth is
   * `inherit` resolves up its ancestor chain at execute time: the
   * innermost carrier (folder beats collection) whose auth is present
   * and not itself `inherit` wins; `none` is a real carrier ("no
   * auth", shadowing outer levels). Field ABSENT means transparent —
   * the walk passes through this level. Persisted inline in
   * `_collection.yaml` (auth is data, not script source).
   */
  auth: v.optional(AuthConfigSchema),
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
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  order: v.optional(v.array(v.string())),
  /** See {@link CollectionSchema}'s script slots — same contract,
   *  request-folder routing only; siblings of `_folder.yaml`. */
  preRequestScript: v.optional(v.string()),
  postResponseScript: v.optional(v.string()),
  /** See {@link CollectionSchema}'s `auth` — same contract,
   *  request-folder routing only; inline in `_folder.yaml`. */
  auth: v.optional(AuthConfigSchema),
});
