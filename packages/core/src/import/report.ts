/**
 * ImportReport — the structured log every importer (curl, HAR,
 * Postman, Insomnia, OpenAPI, workspace-export) emits for one import
 * run.
 *
 * ARCHITECTURE.md §23 specifies the per-source sidecar shape; the
 * V5 workspace-export design (§10) extends it to a discriminated
 * union on `source`. The flat arms (curl / har / postman-v2.1 /
 * insomnia / openapi) carry the same fields as before; the
 * `'workspace-export'` arm carries additional fields the post-import
 * detail panel needs (exportId, perEntityStrategies, missingDeps,
 * targetMode, sourceWorkspaceLabel, sourceAppVersion).
 *
 * The report lives in chrome.storage per-workspace and supports a
 * re-import diff: on re-import, the new report is diffed against the
 * previous (keyed by `sourceHash`) to call out new drops vs
 * previously-dropped-now-supported entries.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from '../schemas/common';
import { CollisionStrategySchema } from '../workspace-export/diff';
import {
  type MissingDep,
  MissingDepSchema,
  type MissingDepType,
  MissingDepTypeSchema,
} from '../workspace-export/missing-deps';

export { MISSING_DEP_TYPES } from '../workspace-export/missing-deps';
export { type MissingDep, MissingDepSchema, type MissingDepType, MissingDepTypeSchema };

// ── Source discriminator ────────────────────────────────────────────

export const FLAT_IMPORT_SOURCES = ['curl', 'har', 'postman-v2.1', 'insomnia', 'openapi'] as const;
export const IMPORT_SOURCES = [...FLAT_IMPORT_SOURCES, 'workspace-export'] as const;
export const ImportSourceSchema = v.picklist(IMPORT_SOURCES);
export type ImportSource = v.InferOutput<typeof ImportSourceSchema>;

// ── Entry shapes (shared) ───────────────────────────────────────────

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
 * wire.
 */
export const ImportTransformSchema = v.object({
  path: v.string(),
  from: v.string(),
  to: v.string(),
  reason: v.string(),
  tracking: v.optional(v.string()),
});
export type ImportTransform = v.InferOutput<typeof ImportTransformSchema>;

/**
 * Counts of what landed — keeps the "top of report" scannable.
 */
export const ImportSummarySchema = v.object({
  imported: v.pipe(v.number(), v.integer(), v.minValue(0)),
  dropped: v.pipe(v.number(), v.integer(), v.minValue(0)),
  transformed: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type ImportSummary = v.InferOutput<typeof ImportSummarySchema>;

// ── workspace-export-specific shapes ────────────────────────────────

export const IMPORT_TARGET_MODES = ['current', 'new', 'picked'] as const;
export const ImportTargetModeSchema = v.picklist(IMPORT_TARGET_MODES);
export type ImportTargetMode = v.InferOutput<typeof ImportTargetModeSchema>;

/**
 * `<entityType>:<uid>` keyed map of the chosen collision strategy per
 * entity. The detail panel renders this as "Auth rule was renamed to
 * avoid collision" rather than just "1 rule imported".
 */
export const PerEntityStrategiesSchema = v.record(v.string(), CollisionStrategySchema);
export type PerEntityStrategies = v.InferOutput<typeof PerEntityStrategiesSchema>;

// ── Discriminated union arms ────────────────────────────────────────

const baseFields = {
  schemaVersion: SchemaVersionSchema,
  /**
   * Stable SHA-256 of the raw input, formatted as `sha256:<hex>`.
   * Empty string is allowed for synchronous parser output — the
   * extension caller hydrates this via `hashImportSource` once
   * WebCrypto is available.
   */
  sourceHash: v.string(),
  importedAt: v.string(),
  summary: ImportSummarySchema,
  drops: v.array(ImportDropSchema),
  transforms: v.array(ImportTransformSchema),
};

const flatArm = <S extends (typeof FLAT_IMPORT_SOURCES)[number]>(source: S) =>
  v.object({
    ...baseFields,
    source: v.literal(source),
  });

export const FlatImportReportSchema = v.variant('source', [
  flatArm('curl'),
  flatArm('har'),
  flatArm('postman-v2.1'),
  flatArm('insomnia'),
  flatArm('openapi'),
]);

export const WorkspaceExportImportReportSchema = v.object({
  ...baseFields,
  source: v.literal('workspace-export'),
  exportId: UidSchema,
  perEntityStrategies: PerEntityStrategiesSchema,
  missingDeps: v.array(MissingDepSchema),
  targetMode: ImportTargetModeSchema,
  sourceWorkspaceLabel: v.string(),
  sourceAppVersion: v.string(),
});
export type WorkspaceExportImportReport = v.InferOutput<typeof WorkspaceExportImportReportSchema>;

export const ImportReportSchema = v.variant('source', [
  v.object({ ...baseFields, source: v.literal('curl') }),
  v.object({ ...baseFields, source: v.literal('har') }),
  v.object({ ...baseFields, source: v.literal('postman-v2.1') }),
  v.object({ ...baseFields, source: v.literal('insomnia') }),
  v.object({ ...baseFields, source: v.literal('openapi') }),
  WorkspaceExportImportReportSchema,
]);
export type ImportReport = v.InferOutput<typeof ImportReportSchema>;

/** Type alias for any flat-arm report (every non-workspace-export source). */
export type FlatImportReport = Exclude<ImportReport, WorkspaceExportImportReport>;

// ── Builder helpers ─────────────────────────────────────────────────

/**
 * Construct an empty report for a flat (external-format) source.
 * Importer mutates `drops` / `transforms` via the helpers below.
 */
export function createReport(source: (typeof FLAT_IMPORT_SOURCES)[number], importedCount = 1): FlatImportReport {
  return {
    schemaVersion: 5,
    source,
    sourceHash: '',
    importedAt: new Date().toISOString(),
    summary: { imported: importedCount, dropped: 0, transformed: 0 },
    drops: [],
    transforms: [],
  } as FlatImportReport;
}

export interface CreateWorkspaceExportReportInput {
  exportId: string;
  importedCount?: number;
  perEntityStrategies?: PerEntityStrategies;
  missingDeps?: MissingDep[];
  targetMode: ImportTargetMode;
  sourceWorkspaceLabel: string;
  sourceAppVersion: string;
}

/**
 * Construct an empty report for a workspace-export import. Caller
 * fills in identity (`exportId`, `targetMode`, source labels) up
 * front; per-entity strategies + missing deps default to empty and
 * are populated via `recordDrop` / direct mutation as the orchestrator
 * runs.
 */
export function createWorkspaceExportReport(input: CreateWorkspaceExportReportInput): WorkspaceExportImportReport {
  return {
    schemaVersion: 5,
    source: 'workspace-export',
    sourceHash: '',
    importedAt: new Date().toISOString(),
    summary: { imported: input.importedCount ?? 0, dropped: 0, transformed: 0 },
    drops: [],
    transforms: [],
    exportId: input.exportId,
    perEntityStrategies: input.perEntityStrategies ?? {},
    missingDeps: input.missingDeps ?? [],
    targetMode: input.targetMode,
    sourceWorkspaceLabel: input.sourceWorkspaceLabel,
    sourceAppVersion: input.sourceAppVersion,
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
