/**
 * detectImportSource — content-based classification of pasted text or a
 * picked file so the import hub routes to the right flow without asking
 * the user for a format (IMPORT_PLAN.md §2.2).
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

  return { kind: 'unknown' };
}
