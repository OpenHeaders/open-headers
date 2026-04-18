/**
 * Shared Valibot primitives for V5 entity schemas.
 *
 * Every persisted entity carries `schemaVersion` + an 8-char uid; the
 * width + charset are checked at the schema layer too, not just via the
 * type, so a corrupted snapshot loaded from disk is rejected at the
 * boundary rather than silently flowing through.
 */

import * as v from 'valibot';

/**
 * Positive integer — matches `schemaVersion: number`. Fresh v5 workspaces
 * start at 5 (aligned with the v5 brand). Breaking changes bump
 * per-entity; the schema stays lenient on lower bounds so a long-lived
 * codebase can still validate a hypothetical v1–v4 snapshot without
 * surgery if one ever shows up. See docs/V5_FOUNDATION_PLAN.md §Phase 0 #3.
 */
export const SchemaVersionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

/** 8-char lowercase-alphanumeric uid (see `packages/core/src/utils/workspace.ts`). */
export const UidSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]{8}$/));

/**
 * Relative workspace path with forward-slash segments, no leading slash.
 * Empty string is disallowed — every persisted entity owns a path.
 * Matches Phase 0 invariant #12.
 */
export const RelativePathSchema = v.pipe(v.string(), v.minLength(1));
