/**
 * Valibot schemas for the workspace manifest + extension-side workspace record.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema, UuidV7Schema } from './common';

/**
 * On-disk `workspace.yaml` + runtime `Workspace`. `rootPath` is
 * runtime-only (absolute path on desktop); the codec (when it lands)
 * strips it on serialize. Schemas are shared by runtime + codec —
 * `rootPath` is optional here because the parsed-from-disk form omits
 * it.
 *
 * `uid` is the Phase 0 invariant #1 identity key — embedded in every
 * persisted YAML and the sole source of truth for cross-entity links.
 */
export const WorkspaceSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /**
   * Accepts both id shapes: 8-char entity uids (fixtures, pre-binding
   * manifests) and uuidv7 — the host workspace store mints uuidv7 ids
   * (`generateWorkspaceId`), and a tree binding writes that id into
   * `workspace.yaml` as the clone join key (GIT_PLAN.md §4).
   */
  uid: v.union([UidSchema, UuidV7Schema]),
  name: v.string(),
  description: v.optional(v.string()),
  defaultEnvironmentId: v.optional(v.string()),
  rootPath: v.optional(v.string()),
  /**
   * Org binding (UNIFIED_ORACLE_MODEL.md §6.1). Canonical source-of-truth
   * for which Org's authorized set the workspace's envelopes ride on.
   * Stamped onto every mutation envelope at mint time; never rewritten on
   * workspace re-binding (§8.2).
   */
  orgId: UuidV7Schema,
});

// ── Extension-side workspace record ──────────────────────────────

export const ExtensionWorkspaceKindSchema = v.picklist(['personal', 'team']);

export const ExtensionWorkspaceSourceSchema = v.object({
  desktopWorkspaceId: v.string(),
  displayPath: v.optional(v.string()),
});

/**
 * Import provenance — stamped when a migration pull mints the
 * workspace as the 1:1 counterpart of a vendor workspace. A re-pull
 * matches by `workspaceId` (rename-safe), never by name; a
 * user-created workspace that happens to share the name is never
 * touched.
 */
export const ExtensionWorkspaceImportedFromSchema = v.object({
  vendor: v.string(),
  workspaceId: v.string(),
});

export const ExtensionWorkspaceSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  id: v.string(),
  kind: ExtensionWorkspaceKindSchema,
  name: v.string(),
  description: v.optional(v.string()),
  color: v.optional(v.string()),
  icon: v.optional(v.string()),
  sortIndex: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
  source: v.optional(ExtensionWorkspaceSourceSchema),
  importedFrom: v.optional(ExtensionWorkspaceImportedFromSchema),
  /** Org binding (see {@link WorkspaceSchema.orgId}). */
  orgId: UuidV7Schema,
});
