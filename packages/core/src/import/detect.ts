/**
 * detectImportSource — content-based classification of pasted text or a
 * picked file so the import hub routes to the right flow without asking
 * the user for a format (the import plan §2.2).
 *
 * Pure + synchronous: the caller already holds the full text (pasted
 * string or `file.text()` result). Detection is intentionally shallow —
 * it answers "which parser should try this", not "will that parser
 * succeed"; the stage-2 flow surfaces real parse errors.
 */

export type DetectedImportSource =
  /** A curl command — route to the curl flow as-is. */
  | { kind: 'curl' }
  /** A bare http(s) URL — route to the curl flow as `curl <url>`. */
  | { kind: 'url'; url: string }
  /** A HAR file (JSON with `log.entries`). */
  | { kind: 'har' }
  /** A Postman collection or environment export. */
  | { kind: 'postman' }
  /** A Postman data-dump backup (`backup-*.json`: version + four section arrays). */
  | { kind: 'postman-backup' }
  /** An Insomnia export — v4 JSON envelope or v5 YAML/JSON document. */
  | { kind: 'insomnia' }
  /** A Bruno `.bru` request file. */
  | { kind: 'bruno' }
  /** An OpenAPI document — 3.x JSON/YAML, plus Swagger 2.0 (the parser
   *  answers those with its honest convert-to-3.x error, not a dead-end). */
  | { kind: 'openapi' }
  /** An `.openheaders.*` workspace export (JSON or YAML). */
  | { kind: 'workspace' }
  /** Nothing recognizable — the hub shows a hint, never a dead-end. */
  | { kind: 'unknown' };

/**
 * Strips shell-prompt noise commonly pasted along with a command:
 * `$ curl …`, `# curl …`, `> curl …`, `PS C:\> curl …`.
 */
function stripPromptPrefix(line: string): string {
  return line.replace(/^(?:PS [^>]*>|[$#>])\s+/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function detectImportSource(text: string): DetectedImportSource {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { kind: 'unknown' };

  const firstLine = stripPromptPrefix(trimmed);
  if (/^curl(?:\.exe)?(?:\s|$)/i.test(firstLine)) return { kind: 'curl' };

  // A bare URL — must be a single token; anything with whitespace is
  // not "just a URL" and shouldn't silently lose the rest of the paste.
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    try {
      const url = new URL(trimmed).toString();
      return { kind: 'url', url };
    } catch {
      // fall through — malformed despite the scheme prefix
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { kind: 'unknown' };
    }
    if (!isRecord(parsed)) return { kind: 'unknown' };

    if (isRecord(parsed.log) && Array.isArray(parsed.log.entries)) return { kind: 'har' };

    // Postman backup envelope — `version` plus all four section arrays.
    // Checked before the collection/environment signatures; the envelope
    // carries neither `info` nor `values`, so it never shadows them.
    if (
      typeof parsed.version === 'number' &&
      Array.isArray(parsed.collections) &&
      Array.isArray(parsed.environments) &&
      Array.isArray(parsed.headerPresets) &&
      Array.isArray(parsed.globals)
    ) {
      return { kind: 'postman-backup' };
    }

    // Insomnia — v4 export envelope (`_type: export` + `__export_format`)
    // or a v5 document saved as JSON (`type: <kind>.insomnia.rest/5.x`).
    if (parsed._type === 'export' && typeof parsed.__export_format === 'number' && Array.isArray(parsed.resources)) {
      return { kind: 'insomnia' };
    }
    if (typeof parsed.type === 'string' && /\.insomnia\.rest\//.test(parsed.type)) return { kind: 'insomnia' };

    // OpenAPI 3.x (`openapi` version field) — and Swagger 2.0
    // (`swagger` field) routes to the same flow: the parser's honest
    // "convert to 3.x" error beats an `unknown` dead-end. Checked
    // before the Postman signatures: an OpenAPI `info` object never
    // carries their markers, but the intent reads clearer this way.
    if (typeof parsed.openapi === 'string' || typeof parsed.swagger === 'string') return { kind: 'openapi' };

    // Postman collection (`info` with schema marker) or environment
    // export (`name` + `values[]`, optionally `_postman_variable_scope`).
    const info = parsed.info;
    if (isRecord(info) && (typeof info.schema === 'string' || typeof info._postman_id === 'string')) {
      return { kind: 'postman' };
    }
    if (typeof parsed.name === 'string' && Array.isArray(parsed.values)) return { kind: 'postman' };

    if (parsed.kind === 'workspace-export') return { kind: 'workspace' };
    return { kind: 'unknown' };
  }

  // YAML workspace export — keyed on the `kind: workspace-export`
  // discriminator line without pulling in a YAML parser here.
  if (/^kind:\s*['"]?workspace-export['"]?\s*$/m.test(trimmed)) return { kind: 'workspace' };

  // Insomnia v5 YAML document — keyed on the `type:` discriminator line
  // (`collection.insomnia.rest/5.0` and siblings), same shallow approach.
  if (/^type:\s*['"]?[\w.-]+\.insomnia\.rest\/\d/m.test(trimmed)) return { kind: 'insomnia' };

  // OpenAPI YAML — keyed on the `openapi:` (or Swagger 2.0 `swagger:`)
  // version discriminator line, same shallow approach; the digit
  // requirement keeps prose mentioning "openapi:" from misfiring.
  if (/^(?:openapi|swagger):\s*['"]?\d/m.test(trimmed)) return { kind: 'openapi' };

  // Bruno `.bru` request file — the grammar has no JSON/YAML envelope,
  // so key on the block-line signature: a `meta {` block plus a method
  // block plus a `url:` line. Requiring all three keeps prose with
  // braces, curl commands, and YAML from misfiring. (Environment-only
  // .bru files carry just a `vars` block and stay unknown here — they
  // arrive via the folder flow, not a lone drop.)
  if (
    /^meta\s*\{\s*$/m.test(trimmed) &&
    /^(?:get|post|put|patch|delete|head|options|connect|trace)\s*\{\s*$/m.test(trimmed) &&
    /^\s*url:\s*\S/m.test(trimmed)
  ) {
    return { kind: 'bruno' };
  }

  return { kind: 'unknown' };
}
