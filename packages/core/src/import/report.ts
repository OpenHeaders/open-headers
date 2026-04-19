/**
 * ImportReport — the structured log every importer (curl, HAR,
 * Postman, Insomnia, OpenAPI) emits for one import run.
 *
 * ARCHITECTURE.md §23 specifies the shape: a per-source sidecar that
 * records what came in, what was dropped, and what was transformed —
 * each entry actionable (linked to a tracking issue or a permanent-
 * design-choice marker) so users can follow up. The report lives in
 * IDB (or chrome.storage for v1) per-user, never in the workspace
 * repo, and supports a re-import diff: on re-import, the new report
 * is diffed against the previous (keyed by `sourceHash`) to call out
 * new drops vs previously-dropped-now-supported entries.
 *
 * V1 ships with one importer (curl) and consumes only a subset of
 * the schema. The full shape is committed upfront so every later
 * importer shares it — zero churn when Postman / HAR / etc. land.
 */

import * as v from 'valibot';
import { SchemaVersionSchema } from '../schemas/common';

// ── Source discriminator ────────────────────────────────────────────

export const IMPORT_SOURCES = ['curl', 'har', 'postman-v2.1', 'insomnia', 'openapi'] as const;
export const ImportSourceSchema = v.picklist(IMPORT_SOURCES);
export type ImportSource = v.InferOutput<typeof ImportSourceSchema>;

// ── Entry shapes ────────────────────────────────────────────────────

/**
 * A value the importer could not map to the V5 schema. The `path`
 * points at the location in the source (curl flag, JSON pointer, etc.)
 * so users can grep for it. `tracking` either links to a GitHub issue
 * ("#issue-123") or a permanent-design-choice marker
 * ("PERMANENT: binary file uploads require content-addressed storage
 * per ARCHITECTURE §6 — deferred to v2").
 */
export const ImportDropSchema = v.object({
  path: v.string(),
  reason: v.string(),
  tracking: v.optional(v.string()),
});
export type ImportDrop = v.InferOutput<typeof ImportDropSchema>;

/**
 * A value the importer rewrote to fit the V5 schema. Transforms are
 * never silent — every rewrite lands in this list so the user can
 * audit that the imported request will behave identically on the
 * wire. `from` / `to` carry the raw shape before/after as short
 * strings (not full JSON — keep the report scannable).
 */
export const ImportTransformSchema = v.object({
  path: v.string(),
  from: v.string(),
  to: v.string(),
  reason: v.string(),
  tracking: v.optional(v.string()),
});
export type ImportTransform = v.InferOutput<typeof ImportTransformSchema>;

// ── Report ──────────────────────────────────────────────────────────

/**
 * Counts of what landed — keeps the "top of report" scannable. The
 * detail lives in `drops` / `transforms`. `imported` counts
 * successfully-imported entities (1 for curl, N for collections).
 */
export const ImportSummarySchema = v.object({
  imported: v.pipe(v.number(), v.integer(), v.minValue(0)),
  dropped: v.pipe(v.number(), v.integer(), v.minValue(0)),
  transformed: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type ImportSummary = v.InferOutput<typeof ImportSummarySchema>;

export const ImportReportSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  source: ImportSourceSchema,
  /**
   * Stable SHA-256 of the raw input, formatted as `sha256:<hex>`.
   * Empty string is allowed for synchronous parser output — the
   * extension caller hydrates this via `hashImportSource` once
   * WebCrypto is available. The hash lets the re-import-diff flow
   * (§23) recognize a previously-imported source without needing
   * the user to remember.
   */
  sourceHash: v.string(),
  importedAt: v.string(),
  summary: ImportSummarySchema,
  drops: v.array(ImportDropSchema),
  transforms: v.array(ImportTransformSchema),
});
export type ImportReport = v.InferOutput<typeof ImportReportSchema>;

// ── Builder helpers (keep importer code terse) ─────────────────────

/**
 * Construct an empty report — importer mutates `drops` / `transforms`
 * via the helpers below, then calls `finalizeReport(report)` to compute
 * `summary` from the accumulated lists.
 */
export function createReport(source: ImportSource, importedCount = 1): ImportReport {
  return {
    schemaVersion: 5,
    source,
    sourceHash: '',
    importedAt: new Date().toISOString(),
    summary: { imported: importedCount, dropped: 0, transformed: 0 },
    drops: [],
    transforms: [],
  };
}

export function recordDrop(report: ImportReport, drop: ImportDrop): void {
  report.drops.push(drop);
  report.summary = { ...report.summary, dropped: report.summary.dropped + 1 };
}

export function recordTransform(report: ImportReport, transform: ImportTransform): void {
  report.transforms.push(transform);
  report.summary = { ...report.summary, transformed: report.summary.transformed + 1 };
}

/**
 * Compute a canonical SHA-256 of an import source. Uses WebCrypto
 * (`globalThis.crypto.subtle`) — works in browsers, MV3 service
 * workers, and Node 18+. Returns the `sha256:<hex>` format that
 * ARCHITECTURE.md §23 prescribes.
 *
 * Kept separate from `createReport` so the parser stays synchronous
 * — callers that need the hash (extension UI) await it after parsing,
 * then set `report.sourceHash = await hashImportSource(input)`.
 */
export async function hashImportSource(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
