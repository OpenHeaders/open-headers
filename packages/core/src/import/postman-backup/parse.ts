import { buildHeaders } from '../postman/auth';
import { type PostmanEnvironmentParseResult, parsePostmanEnvironment } from '../postman/environment';
import { parsePostman } from '../postman/parse';
import type { PostmanHeader, PostmanParseResult } from '../postman/types';
import { createReport, type ImportReport, recordDrop, recordTransform } from '../report';
import type { PostmanBackupParsedPreset, PostmanBackupParseResult } from './types';
import { PostmanBackupParseError } from './types';

// ── Entry point ────────────────────────────────────────────────────

/**
 * Parse a Postman `backup-*.json` data dump:
 * `{version: 1, collections: [], environments: [], headerPresets: [], globals: []}`
 * (schema verified on a live install — MIGRATION_PLAN.md §2.2).
 *
 * The envelope parser owns only the envelope: `collections[]` entries
 * carrying the v2.x `info` marker delegate to `parsePostman`,
 * `environments[]` and `globals[]` to `parsePostmanEnvironment`, and
 * `headerPresets[]` land as named header bundles. Every unreadable
 * section, entry, or legacy-format collection gets a report drop with
 * a full reason — never a throw-through, never a silent skip.
 */
export function parsePostmanBackup(input: string): PostmanBackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new PostmanBackupParseError(
      `Backup file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!isRecord(parsed)) {
    throw new PostmanBackupParseError('Expected a JSON object with `version` + section arrays.');
  }
  if (parsed.version !== 1) {
    throw new PostmanBackupParseError(
      `Unsupported backup version ${JSON.stringify(parsed.version)} — only version 1 is supported.`,
    );
  }

  const report = createReport('postman-backup', 0);

  const collections = parseCollections(sectionArray(parsed, 'collections', report), report);
  const environments = parseEnvironments(sectionArray(parsed, 'environments', report), report);
  const globals = parseGlobals(sectionArray(parsed, 'globals', report), report);
  const headerPresets = parseHeaderPresets(sectionArray(parsed, 'headerPresets', report), report);
  report.summary = { ...report.summary, imported: report.summary.imported + headerPresets.length };

  return {
    collections,
    environments,
    globals,
    headerPresets,
    counts: {
      collections: collections.length,
      environments: environments.length,
      globals: globals ? 1 : 0,
      headerPresets: headerPresets.length,
    },
    report,
  };
}

// ── Sections ───────────────────────────────────────────────────────

function parseCollections(raw: unknown[], report: ImportReport): PostmanParseResult[] {
  const out: PostmanParseResult[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const path = `backup.collections[${i}]`;
    if (!isRecord(entry)) {
      recordDrop(report, { path, reason: 'Not an object — skipped.', tracking: 'PERMANENT: backup shape validation' });
      continue;
    }
    if (!isRecord(entry.info)) {
      // No v2.x `info` marker. Legacy v1 collections (name + order/
      // folders/requests) are structurally different — the collection
      // parser would shred them, so they drop whole with guidance.
      const name = typeof entry.name === 'string' ? entry.name : '';
      const looksLegacy = name.length > 0 && ['order', 'folders', 'requests'].some((k) => Array.isArray(entry[k]));
      recordDrop(report, {
        path,
        reason: looksLegacy
          ? `Collection "${name}" is in the legacy v1 collection format — re-export it as Collection v2.1, or import it via the API-key pull.`
          : 'Unrecognized collection shape (no `info` marker) — skipped.',
        tracking: looksLegacy ? '#todo-backup-v1-collections' : 'PERMANENT: backup shape validation',
      });
      continue;
    }
    try {
      const sub = parsePostman(JSON.stringify(entry));
      mergeSubReport(report, sub.report, `${path}.`);
      out.push(sub);
    } catch (err) {
      recordDrop(report, {
        path,
        reason: `Collection could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
        tracking: 'PERMANENT: backup shape validation',
      });
    }
  }
  return out;
}

function parseEnvironments(raw: unknown[], report: ImportReport): PostmanEnvironmentParseResult[] {
  const out: PostmanEnvironmentParseResult[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const path = `backup.environments[${i}]`;
    if (!isRecord(entry) || !Array.isArray(entry.values)) {
      recordDrop(report, {
        path,
        reason: 'Unrecognized environment shape (no `values` array) — skipped.',
        tracking: 'PERMANENT: backup shape validation',
      });
      continue;
    }
    const sub = tryParseEnvironment(entry, path, report);
    if (sub) out.push(sub);
  }
  return out;
}

/**
 * `globals[]` lands as one environment named "Globals" — the same
 * convention the collection importer relies on for flat `{{var}}`
 * resolution. Two shapes are tolerated: an array of value rows
 * (`{key, value, …}`) and an array holding exported scope objects
 * (`{name?, values: []}`); extra scope objects beyond the first drop
 * with a report entry rather than merging silently.
 */
function parseGlobals(raw: unknown[], report: ImportReport): PostmanEnvironmentParseResult | null {
  if (raw.length === 0) return null;
  const first = raw[0];
  if (isRecord(first) && Array.isArray(first.values)) {
    const name = (typeof first.name === 'string' ? first.name.trim() : '') || 'Globals';
    for (let i = 1; i < raw.length; i++) {
      recordDrop(report, {
        path: `backup.globals[${i}]`,
        reason: 'Additional globals scope beyond the first — not imported.',
        tracking: 'PERMANENT: single globals scope',
      });
    }
    return tryParseEnvironment({ name, values: first.values }, 'backup.globals[0]', report);
  }
  if (raw.some((g) => isRecord(g) && typeof g.key === 'string')) {
    return tryParseEnvironment({ name: 'Globals', values: raw }, 'backup.globals', report);
  }
  recordDrop(report, {
    path: 'backup.globals',
    reason: 'Unrecognized globals shape — skipped.',
    tracking: 'PERMANENT: backup shape validation',
  });
  return null;
}

function parseHeaderPresets(raw: unknown[], report: ImportReport): PostmanBackupParsedPreset[] {
  const out: PostmanBackupParsedPreset[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const path = `backup.headerPresets[${i}]`;
    if (!isRecord(entry)) {
      recordDrop(report, { path, reason: 'Not an object — skipped.', tracking: 'PERMANENT: backup shape validation' });
      continue;
    }
    const name = (typeof entry.name === 'string' ? entry.name.trim() : '') || 'Imported Preset';
    if (!Array.isArray(entry.headers)) {
      recordDrop(report, {
        path,
        reason: `Header preset "${name}" has no \`headers\` array — skipped.`,
        tracking: 'PERMANENT: backup shape validation',
      });
      continue;
    }
    const rows: PostmanHeader[] = entry.headers.filter(isRecord).map((r) => ({
      key: typeof r.key === 'string' ? r.key : undefined,
      value: typeof r.value === 'string' ? r.value : undefined,
      disabled: r.disabled === true || r.enabled === false ? true : undefined,
    }));
    out.push({ name, headers: buildHeaders(rows, path, report) });
  }
  return out;
}

// ── Helpers ────────────────────────────────────────────────────────

function tryParseEnvironment(
  envelope: Record<string, unknown>,
  path: string,
  report: ImportReport,
): PostmanEnvironmentParseResult | null {
  try {
    const sub = parsePostmanEnvironment(JSON.stringify(envelope));
    mergeSubReport(report, sub.report, `${path}.`);
    return sub;
  } catch (err) {
    recordDrop(report, {
      path,
      reason: `Environment could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
      tracking: 'PERMANENT: backup shape validation',
    });
    return null;
  }
}

function sectionArray(file: Record<string, unknown>, key: string, report: ImportReport): unknown[] {
  const value = file[key];
  if (Array.isArray(value)) return value;
  if (value !== undefined) {
    recordDrop(report, {
      path: `backup.${key}`,
      reason: `Expected an array for \`${key}\` — section skipped.`,
      tracking: 'PERMANENT: backup shape validation',
    });
  }
  return [];
}

function mergeSubReport(target: ImportReport, sub: ImportReport, prefix: string): void {
  for (const d of sub.drops) recordDrop(target, { ...d, path: `${prefix}${d.path}` });
  for (const t of sub.transforms) recordTransform(target, { ...t, path: `${prefix}${t.path}` });
  target.summary = { ...target.summary, imported: target.summary.imported + sub.summary.imported };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
