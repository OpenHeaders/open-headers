/**
 * Postman backup import — parse the periodic `backup-*.json` data dump
 * Postman writes to its app-support root (schema verified live:
 * MIGRATION_PLAN.md §2.2) into per-section results + one aggregate
 * `ImportReport`.
 *
 * Scope (Migration epic Phase 1):
 *   • Envelope — `{version: 1, collections, environments, headerPresets,
 *     globals}`. Unknown `version` is a structured `PostmanBackupParseError`;
 *     malformed sections drop with report entries.
 *   • `collections[]` — v2.x entries (carrying `info`) delegate to
 *     `parsePostman`; legacy v1-shaped entries drop whole with guidance
 *     (re-export as v2.1 / use the API-key pull) rather than shredding.
 *   • `environments[]` + `globals[]` — delegate to
 *     `parsePostmanEnvironment`; globals land as one environment named
 *     "Globals" so imported `{{var}}` references keep resolving.
 *   • `headerPresets[]` — named header bundles, parsed to `RequestHeader`
 *     rows. Target entity: one unpublished extension header rule per
 *     preset (MIGRATION_STATUS.md S2 decision); desktop treats them as
 *     pass-through.
 *   • Per-section counts (`counts`) feed the Phase 4 findings inventory
 *     verbatim; sub-parser drops/transforms merge into the aggregate
 *     report with `backup.<section>[i].` path prefixes.
 *
 * Pure envelope-plus-delegation: no filesystem access — the Phase 4
 * scanner (host-node, consent-gated) hands over file contents.
 */

export { parsePostmanBackup } from './parse';
export {
  type PostmanBackupCounts,
  type PostmanBackupParsedPreset,
  PostmanBackupParseError,
  type PostmanBackupParseResult,
} from './types';
