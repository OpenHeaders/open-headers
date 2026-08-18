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
 * persisted entity below 5 is rejected at the boundary. v5 launched
 * fresh with no prior users to support — so we don't carry a compat
 * pane for v1–v4. Future breaking changes in
 * any entity bump per-entity (6, 7, …). See
 * the v5 foundation plan §Phase 0 #3.
 */
export const MIN_SCHEMA_VERSION = 5;
export const SchemaVersionSchema = v.pipe(v.number(), v.integer(), v.minValue(MIN_SCHEMA_VERSION));

/** 8-char lowercase-alphanumeric uid (see `packages/core/src/utils/workspace.ts`). */
export const UidSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/));

/**
 * UUIDv7 — RFC 9562 §5.7 layout (version nibble = 7, variant bits = 10).
 * Identity-schema rows (User, Org, UserIdentity, Session, OrgMembership,
 * Principal, WorkspaceRoleAssignment, AuditLogEntry) are keyed by UUIDv7.
 * Synthetic rows use deterministic UUIDv7s seeded from `host-install-id`
 * (per the unified-oracle model §5.1); the regex accepts those identically
 * since the seed expands to a valid v7 layout.
 */
export const UuidV7Schema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
);

/**
 * Relative workspace path with forward-slash segments, no leading slash.
 * Empty string is disallowed — every persisted entity owns a path.
 * Matches Phase 0 invariant #12.
 */
export const RelativePathSchema = v.pipe(v.string(), v.minLength(1));
