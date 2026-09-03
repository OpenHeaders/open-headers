/**
 * Valibot schema for `Collection` — the folder that holds rules
 * or requests + collection-scoped variables.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { InheritableSettingsSchema } from './inheritable-settings';
import { AuthConfigSchema, ConcreteAuthConfigSchema } from './request';
import { SessionScriptSlotsSchema } from './script-slots';
import { VariableSchema } from './variable';

/**
 * Per-link generation bookkeeping on a collection generated from a
 * spec document. `specUid` is the source spec (ids-only identity — the
 * spec may be deleted later; consumers derive link health at read
 * time). `sourceHash` is the spec root file's content hash at
 * generation time — drift is judged by comparing it against the
 * current content, never by caching live state. One spec links to
 * many collections; each collection carries its own link.
 */
export const SpecLinkSchema = v.object({
  specUid: UidSchema,
  sourceHash: v.string(),
});

/**
 * One entry of a container's auth pool — a named, concrete auth
 * config a collection or folder keeps for the requests under it. The
 * pool's DEFAULT entry (`defaultAuthUid`, else the first) is what a
 * request set to Inherit sends with; every entry is a pick a request
 * may name by uid. `name` is the user's label ("Admin token"); empty
 * = the type's label. `appliesTo` is an optional host pattern (`*`
 * wildcard, `api.openheaders.com` / `*.openheaders.com`): when the
 * request's URL host matches, the entry applies ahead of the default.
 * Set-modeled on the entity (member identity = `uid`, the variables
 * idiom) so concurrent edits of two entries never clobber each other.
 */
export const AuthPoolEntrySchema = v.object({
  uid: UidSchema,
  name: v.string(),
  config: ConcreteAuthConfigSchema,
  appliesTo: v.optional(v.string()),
});

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
   * The session kinds' ancestor slots — one key per kind
   * (`@openheaders/core/scripts` — `SESSION_SCRIPT_KINDS`), each
   * composed the same ancestor-first way for the requests of that kind
   * under the collection and no other. Every key fans out to its
   * `<kind>.js` sibling, never inline. Absent key ↔ no script.
   */
  scripts: v.optional(SessionScriptSlotsSchema),
  /**
   * The auth pool — meaningful under request-collection routing only,
   * like the script slots. A request whose auth is `inherit` resolves
   * up its ancestor chain at execute time: the innermost level with a
   * non-empty pool supplies the DEFAULT (`defaultAuthUid`, else the
   * first entry; a host-scoped entry first) — a folder's pool overrides
   * the collection's default, `none` is a real entry ("no auth",
   * shadowing outer levels) — and a request may name ANY entry up the
   * chain by uid. Pool ABSENT or empty means transparent — the walk
   * passes through this level. Persisted inline in `_collection.yaml`
   * (auth is data, not script source).
   */
  auths: v.optional(v.array(AuthPoolEntrySchema)),
  defaultAuthUid: v.optional(UidSchema),
  /**
   * The pre-pool single default auth (2026.8.x). READ ONLY: a
   * container carrying it and no pool reads as a one-entry pool
   * (`authPoolOf`); the first pool write clears it. Never written.
   */
  auth: v.optional(AuthConfigSchema),
  /**
   * The inheritable request settings — meaningful under
   * request-collection routing only, like the pool. ONE nested object
   * under the request kinds' own field names
   * (`@openheaders/core/schemas` — `InheritableSettingsSchema`): a
   * request that leaves a knob absent reads the NEAREST ancestor that
   * sets it (`@openheaders/core/settings-inheritance`), per knob — a
   * folder's `timeoutMs` shadows the collection's while the
   * collection's `sslVerification` still applies. Absent or empty =
   * transparent. Persisted inline in `_collection.yaml`; the sync
   * flattener keys one leaf per knob.
   */
  settings: v.optional(InheritableSettingsSchema),
  /** Present only on collections generated from a spec document. */
  specLink: v.optional(SpecLinkSchema),
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
  scripts: v.optional(SessionScriptSlotsSchema),
  /** See {@link CollectionSchema}'s pool — same contract,
   *  request-folder routing only; inline in `_folder.yaml`. */
  auths: v.optional(v.array(AuthPoolEntrySchema)),
  defaultAuthUid: v.optional(UidSchema),
  /** See {@link CollectionSchema}'s `auth` — the pre-pool field, read only. */
  auth: v.optional(AuthConfigSchema),
  /** See {@link CollectionSchema}'s `settings` — same contract,
   *  request-folder routing only; inline in `_folder.yaml`. */
  settings: v.optional(InheritableSettingsSchema),
});
