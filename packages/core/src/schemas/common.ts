/**
 * Shared Valibot primitives for V5 entity schemas.
 *
 * Every persisted entity carries `schemaVersion` + an 8-char uid; the
 * width + charset are checked at the schema layer too, not just via the
 * type, so a corrupted snapshot loaded from disk is rejected at the
 * boundary rather than silently flowing through.
 */

import * as v from 'valibot';

/** Positive integer — matches `schemaVersion: number`. */
export const SchemaVersionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

/** 8-char lowercase-alphanumeric uid (see `packages/core/src/utils/workspace.ts`). */
export const UidSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/));

/**
 * Relative workspace path with forward-slash segments, no leading slash.
 * Empty string is disallowed — every persisted entity owns a path.
 * Matches Phase 0 invariant #12.
 */
export const RelativePathSchema = v.pipe(v.string(), v.minLength(1));
