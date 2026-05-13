/**
 * Shared Valibot primitives for entity schemas.
 *
 * Every persisted entity carries `schemaVersion` + an 8-char uid; the
 * width + charset are checked at the schema layer too, not just via the
 * type, so a corrupted snapshot loaded from disk is rejected at the
 * boundary rather than silently flowing through.
 */

import * as v from 'valibot';

/**
 * The data-model baseline. Fresh workspaces carry `schemaVersion: 5`; any
 * persisted entity below 5 is rejected at the boundary. There is no
 * prior users to support (per memory: project_v5_fresh_start) — so
 * we don't carry a compat pane for v1–v4. Future breaking changes in
 * any entity bump per-entity (6, 7, …). See
 * docs/V5_FOUNDATION_PLAN.md §Phase 0 #3.
 */
export const MIN_SCHEMA_VERSION = 5;
export const SchemaVersionSchema = v.pipe(v.number(), v.integer(), v.minValue(MIN_SCHEMA_VERSION));

/** 8-char lowercase-alphanumeric uid (see `packages/core/src/utils/workspace.ts`). */
export const UidSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/));

/**
 * Relative workspace path with forward-slash segments, no leading slash.
 * Empty string is disallowed — every persisted entity owns a path.
 * Matches Phase 0 invariant #12.
 */
export const RelativePathSchema = v.pipe(v.string(), v.minLength(1));
