/**
 * Valibot schemas for the workspace manifest + extension-side workspace record.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

/**
 * On-disk `workspace.yaml` + runtime `V5.Workspace`. `rootPath` is
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
  uid: UidSchema,
  name: v.string(),
  description: v.optional(v.string()),
  defaultEnvironmentId: v.optional(v.string()),
  rootPath: v.optional(v.string()),
});

// ── Extension-side workspace record ──────────────────────────────

export const ExtensionWorkspaceKindSchema = v.picklist(['personal', 'team']);

export const ExtensionWorkspaceSourceSchema = v.object({
  desktopWorkspaceId: v.string(),
  displayPath: v.optional(v.string()),
});

export const ExtensionWorkspaceSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /**
   * Phase 10 monotonic write counter — advances on every
   * createWorkspace / updateWorkspace / reorderWorkspaces / delete
   * mutation. Protects WorkspaceManager's rename dialog against
   * concurrent edits from two tabs (both dialogs send the patch with
   * the version they loaded; the second one lands as `stale-draft`).
   */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
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
});
