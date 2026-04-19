/**
 * Importers — curl (v1), HAR / Postman / Insomnia / OpenAPI (v2+).
 *
 * Every importer produces an `ImportReport` alongside the imported
 * entities so users can audit drops/transforms per ARCHITECTURE.md §23.
 */

export { CurlParseError, type CurlParseResult, type CurlRequest, parseCurl, tokenize } from './curl';
export {
  diffImportReports,
  type ImportReportDiff,
  type ImportSummaryDelta,
  type ReportDiffPartition,
} from './diff';
export { type HarParsedEntry, HarParseError, type HarParseResult, parseHar, selectHarEntries } from './har';
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
  createReport,
  hashImportSource,
  IMPORT_SOURCES,
  type ImportDrop,
  ImportDropSchema,
  type ImportReport,
  ImportReportSchema,
  type ImportSource,
  ImportSourceSchema,
  type ImportSummary,
  ImportSummarySchema,
  type ImportTransform,
  ImportTransformSchema,
  recordDrop,
  recordTransform,
} from './report';
