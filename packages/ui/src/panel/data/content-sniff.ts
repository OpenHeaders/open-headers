/**
 * Content-type sniffing for response/request bodies.
 *
 * Servers regularly misdeclare bodies (`text/plain` on JSON,
 * `application/octet-stream` on XML, no Content-Type at all). The
 * viewer shouldn't blindly follow the header — if we can tell the
 * body is structured, we offer the user an explicit "parse as X"
 * action. Detection is best-effort and conservative: we'd rather say
 * `null` than mislabel.
 */

export type DetectedFormat = 'json' | 'xml' | 'html' | 'form-urlencoded' | 'base64';

/**
 * Does the declared mime type carry no format commitment? Only three
 * mimes qualify:
 *
 *   - missing / empty             — the server told us nothing
 *   - `text/plain`                — "it's text, don't ask me what kind"
 *   - `application/octet-stream`  — "it's bytes"
 *
 * Everything else — including `application/x-www-form-urlencoded`,
 * `text/html`, `application/xml`, etc. — is a **commitment** and the
 * sniffer does not second-guess it. Re-interpreting a declared form
 * body as JSON because it starts with `{` would be a false positive.
 */
export function isGenericMime(mime: string | undefined | null): boolean {
  if (!mime) return true;
  const base = mime.toLowerCase().split(';')[0].trim();
  return base === '' || base === 'text/plain' || base === 'application/octet-stream';
}

/** Mime-ify a detected format for downstream components that key off mime. */
export function detectedFormatToMime(format: DetectedFormat): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'html':
      return 'text/html';
    case 'form-urlencoded':
      return 'application/x-www-form-urlencoded';
    case 'base64':
      return 'application/octet-stream';
  }
}

/** User-facing label — what the "Parse as" button says. */
export function detectedFormatLabel(format: DetectedFormat): string {
  switch (format) {
    case 'json':
      return 'JSON';
    case 'xml':
      return 'XML';
    case 'html':
      return 'HTML';
    case 'form-urlencoded':
      return 'Form data';
    case 'base64':
      return 'Base64';
  }
}

const JSON_LEAD = /^[\s]*[{[]/;
const XML_DECL = /^[\s]*<\?xml\b/i;
const XML_TAG = /^[\s]*<([a-z_][\w.:-]*)\b[^>]*>/i;
const HTML_LEAD = /^[\s]*(<!doctype\s+html\b|<html\b|<head\b|<body\b)/i;
const FORM_URLENCODED = /^[\w%+.~*-]+=[^&\n\r]*(&[\w%+.~*-]+=[^&\n\r]*)+$/;
const BASE64_CHARS = /^[A-Za-z0-9+/\s]+=?=?$/;

/**
 * Sniff the structural format of `text`. Returns `null` when nothing
 * conclusive can be said (plain prose, numeric data, too short, etc.).
 *
 * Order matters: JSON is checked first because its lead characters
 * are a strict superset of most other options. XML before HTML so
 * `<?xml ...?>` wrapped HTML is still called XML. `form-urlencoded`
 * and `base64` are last because their regexes are loose.
 */
export function sniffContentFormat(text: string): DetectedFormat | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;

  // JSON — leading { or [, then a full parse.
  if (JSON_LEAD.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Keep trying other formats.
    }
  }

  // HTML before generic XML — both are tag-based but HTML has
  // recognisable leads.
  if (HTML_LEAD.test(trimmed)) return 'html';
  if (XML_DECL.test(trimmed)) return 'xml';
  if (XML_TAG.test(trimmed)) return 'xml';

  // form-urlencoded — requires at least one `&`-separated pair so we
  // don't flag single `key=value` prose.
  if (FORM_URLENCODED.test(trimmed)) return 'form-urlencoded';

  // Base64 — plausible only for non-trivial lengths. We require length
  // divisible by 4 (ignoring whitespace) and only base64 characters.
  // 64 chars is a reasonable floor to avoid false positives like
  // "ABCD" or "hello=".
  const compact = trimmed.replace(/\s+/g, '');
  if (compact.length >= 64 && compact.length % 4 === 0 && BASE64_CHARS.test(trimmed)) {
    return 'base64';
  }

  return null;
}

/**
 * Convenience: detect a format only when the mime is generic. Returns
 * null if the mime was specific (already trusted) or detection fails.
 */
export function sniffMisdeclared(text: string, declaredMime: string | undefined | null): DetectedFormat | null {
  if (!isGenericMime(declaredMime)) return null;
  return sniffContentFormat(text);
}
