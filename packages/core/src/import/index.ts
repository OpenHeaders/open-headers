/**
 * Importers — curl (v1), HAR / Postman / Insomnia / OpenAPI (v2+).
 *
 * Every importer produces an `ImportReport` alongside the imported
 * entities so users can audit drops/transforms per ARCHITECTURE.md §23.
 */

export { CurlParseError, type CurlParseResult, type CurlRequest, parseCurl, tokenize } from './curl';
export { type DetectedImportSource, detectImportSource } from './detect';
export {
  diffImportReports,
  type ImportReportDiff,
  type ImportSummaryDelta,
  type ReportDiffPartition,
} from './diff';
export {
  convertHarRequest,
  type HarParsedEntry,
  HarParseError,
  type HarParseResult,
  type HarRequest,
  parseHar,
  selectHarEntries,
} from './har';
export {
  flattenEnvironmentData,
  type InsomniaParsedCollection,
  type InsomniaParsedEnvironment,
  type InsomniaParsedEnvironmentVariable,
  type InsomniaParsedFolder,
  type InsomniaParsedRequest,
  InsomniaParseError,
  type InsomniaParseResult,
  parseInsomnia,
  parseInsomniaDocs,
  rewriteTemplateRefs,
} from './insomnia';
export {
  type PostmanCollectionVariable,
  type PostmanEnvironmentParseResult,
  type PostmanParsedEnvironmentVariable,
  type PostmanParsedFolder,
  type PostmanParsedRequest,
  PostmanParseError,
  type PostmanParseResult,
  parsePostman,
  parsePostmanEnvironment,
} from './postman';
export {
  type PostmanBackupCounts,
  type PostmanBackupParsedPreset,
  PostmanBackupParseError,
  type PostmanBackupParseResult,
  parsePostmanBackup,
} from './postman-backup';
export {
  type CreateWorkspaceExportReportInput,
  createReport,
  createWorkspaceExportReport,
  FLAT_IMPORT_SOURCES,
  type FlatImportReport,
  FlatImportReportSchema,
  hashImportSource,
  IMPORT_SOURCES,
  IMPORT_TARGET_MODES,
  type ImportDrop,
  ImportDropSchema,
  type ImportReport,
  ImportReportSchema,
  type ImportSource,
  ImportSourceSchema,
  type ImportSummary,
  ImportSummarySchema,
  type ImportTargetMode,
  ImportTargetModeSchema,
  type ImportTransform,
  ImportTransformSchema,
  MISSING_DEP_TYPES,
  type MissingDep,
  MissingDepSchema,
  type MissingDepType,
  MissingDepTypeSchema,
  type PerEntityStrategies,
  PerEntityStrategiesSchema,
  recordDrop,
  recordTransform,
  type WorkspaceExportImportReport,
  WorkspaceExportImportReportSchema,
} from './report';
