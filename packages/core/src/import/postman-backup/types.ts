import type { RequestHeader } from '../../types/request';
import type { PostmanEnvironmentParseResult } from '../postman/environment';
import type { PostmanParseResult } from '../postman/types';
import type { ImportReport } from '../report';

// ── Output ─────────────────────────────────────────────────────────

/**
 * One named header bundle from `headerPresets[]`. Header rows reuse
 * `RequestHeader` (same shape `buildHeaders` emits for requests) so
 * downstream consumers mint header-rule modifications from them
 * without a second normalization pass. The settled target entity is
 * an unpublished extension header rule per preset (MIGRATION_STATUS
 * S2 decision); on desktop the presets are pass-through.
 */
export interface PostmanBackupParsedPreset {
  name: string;
  headers: RequestHeader[];
}

/**
 * Per-section counts of what the backup carried and this parser could
 * read. The Phase 4 findings inventory renders these verbatim
 * ("N collections · M environments · K header presets").
 */
export interface PostmanBackupCounts {
  collections: number;
  environments: number;
  globals: number;
  headerPresets: number;
}

export interface PostmanBackupParseResult {
  /** One entry per readable v2.x collection, via the collection parser. */
  collections: PostmanParseResult[];
  /** One entry per readable environment, via the environment parser. */
  environments: PostmanEnvironmentParseResult[];
  /** Globals landed as one environment named "Globals"; null when the backup carries none. */
  globals: PostmanEnvironmentParseResult | null;
  headerPresets: PostmanBackupParsedPreset[];
  counts: PostmanBackupCounts;
  /** Aggregate report — sub-parser drops/transforms merged in with `backup.<section>[i].` path prefixes. */
  report: ImportReport;
}

export class PostmanBackupParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostmanBackupParseError';
  }
}
