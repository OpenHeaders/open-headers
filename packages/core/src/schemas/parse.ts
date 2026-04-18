/**
 * parseEntity — tolerant wrapper around `v.safeParse` for storage reads.
 *
 * Why not just `v.parse`? A corrupted snapshot in `chrome.storage.local`
 * (manual DevTools edit, sync conflict, bit-rot) should not crash the
 * extension — we read, validate, and either return the parsed value or
 * fall through to the caller-supplied default. Matches the spirit of
 * ARCHITECTURE.md §7's three-tier migration story: preserve-unknown on
 * write, validate on read.
 *
 * The `onError` callback gives the observability-log subsystem a hook
 * to record shape drift events without this module having to know about
 * telemetry.
 */

import * as v from 'valibot';

export interface ParseEntityOptions {
  /** Called with the raw (unparsed) value + the valibot issues when parsing fails. */
  onError?: (raw: unknown, issues: readonly v.BaseIssue<unknown>[]) => void;
}

/**
 * Parse `raw` with `schema`; return null on failure.
 *
 * Use instead of `v.parse` at storage / RPC boundaries. When a
 * corrupted value lands, callers can substitute a fresh default and
 * keep going rather than throwing into a context the user can't recover.
 */
export function parseEntity<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  raw: unknown,
  options: ParseEntityOptions = {},
): v.InferOutput<TSchema> | null {
  const result = v.safeParse(schema, raw);
  if (result.success) return result.output;
  options.onError?.(raw, result.issues);
  return null;
}

/**
 * Parse an array of entities; entries that fail the schema are dropped
 * (with an `onError` callback per entry, so one bad row doesn't poison
 * the whole list). Returns the surviving entries.
 */
export function parseEntityArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  raw: unknown,
  options: ParseEntityOptions = {},
): Array<v.InferOutput<TSchema>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<v.InferOutput<TSchema>> = [];
  for (const entry of raw) {
    const parsed = parseEntity(schema, entry, options);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}
