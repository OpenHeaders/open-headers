import { createReport, type ImportReport, recordDrop } from '../report';
import { PostmanParseError } from './types';

// ── Postman Environment (.postman_environment.json) ────────────────

/**
 * A Postman environment file has a different top-level shape than a
 * collection — no `info` or `item`, just `name` + `values[]`. Users
 * export environments separately in Postman, so this parser handles
 * them as a sibling flow. Both share the same ImportReport scaffold.
 */
interface PostmanEnvironmentFile {
  id?: string;
  name?: string;
  values?: Array<{
    key?: string;
    value?: string;
    type?: 'default' | 'secret' | 'any' | string;
    enabled?: boolean;
    description?: string;
  }>;
  _postman_variable_scope?: string;
}

/**
 * Normalized variable — matches `Variable`. `type: 'secret'`
 * lands verbatim so the secret/default split is preserved. A vendor
 * `enabled: false` row imports as a disabled row (`enabled: false`;
 * the flag is ABSENT for enabled rows, matching the model's
 * absent-means-enabled contract).
 */
export interface PostmanParsedEnvironmentVariable {
  name: string;
  value: string;
  type: 'default' | 'secret';
  enabled?: boolean;
  description?: string;
}

export interface PostmanEnvironmentParseResult {
  name: string;
  variables: PostmanParsedEnvironmentVariable[];
  report: ImportReport;
}

/**
 * Parse a Postman environment JSON. Returns the name + a list of
 * variables ready to be attached to a fresh Environment.
 * Disabled entries import as disabled rows (`enabled: false`).
 * Non-string values are coerced via `String(...)` rather than
 * dropped — an environment with a numeric port number is still
 * useful to import.
 */
export function parsePostmanEnvironment(input: string): PostmanEnvironmentParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new PostmanParseError(
      `Postman environment is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new PostmanParseError('Expected a JSON object with `name` + `values` fields.');
  }
  const file = parsed as PostmanEnvironmentFile;
  const scope = file._postman_variable_scope ?? '';
  if (scope && scope !== 'environment') {
    throw new PostmanParseError(`Expected a Postman environment file (scope: "environment"), got scope "${scope}".`);
  }

  const name = (file.name ?? 'Imported Environment').trim() || 'Imported Environment';
  const report = createReport('postman-v2.1', 0);
  const variables: PostmanParsedEnvironmentVariable[] = [];

  if (Array.isArray(file.values)) {
    for (let i = 0; i < file.values.length; i++) {
      const v = file.values[i];
      const jsonPath = `environment.values[${i}]`;
      const key = v?.key?.trim();
      if (!key) {
        recordDrop(report, {
          path: jsonPath,
          reason: 'Variable has no `key` — skipped.',
          tracking: 'PERMANENT: Postman environment shape',
        });
        continue;
      }
      const value = typeof v?.value === 'string' ? v.value : String(v?.value ?? '');
      const type: 'default' | 'secret' = v?.type === 'secret' ? 'secret' : 'default';
      variables.push({
        name: key,
        value,
        type,
        // Disabled rows import as disabled — the model carries the flag
        // natively, so this is lossless and silent (no report note).
        ...(v?.enabled === false ? { enabled: false } : {}),
        description: v?.description,
      });
    }
  }

  report.summary = { ...report.summary, imported: variables.length };
  return { name, variables, report };
}
