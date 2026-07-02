import { placeholderFileRef } from '../../files';
import type { AuthConfig, HttpMethod, MultipartPart } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { ParserState } from './state';
import { CurlParseError } from './types';

// ── Token dispatch ──────────────────────────────────────────────────

export function consumeToken(
  token: string,
  tokens: string[],
  cursor: number,
  state: ParserState,
  report: ImportReport,
): number {
  // Positional URL — first non-flag that's not a sub-value of a flag.
  if (!token.startsWith('-')) {
    if (state.url === null) {
      state.url = token;
      return cursor + 1;
    }
    // Subsequent positional — curl accepts multiple URLs, we take the
    // first and drop the rest. Extremely rare in copy-paste imports.
    recordDrop(report, {
      path: `positional[${cursor}]`,
      reason: `Additional URL arguments not supported (only the first URL is imported): ${token}`,
      tracking: 'PERMANENT: one request per import',
    });
    return cursor + 1;
  }

  switch (token) {
    // ── Method ─────────────────────────────────────────────────────
    case '-X':
    case '--request': {
      const value = requireNext(tokens, cursor, token);
      state.method = coerceMethod(value, report, token);
      return cursor + 2;
    }

    // ── URL alias ──────────────────────────────────────────────────
    case '--url': {
      const value = requireNext(tokens, cursor, token);
      if (state.url === null) state.url = value;
      return cursor + 2;
    }

    // ── Headers ────────────────────────────────────────────────────
    case '-H':
    case '--header': {
      const value = requireNext(tokens, cursor, token);
      const parsed = parseHeader(value);
      if (parsed) state.headers.push(parsed);
      else {
        recordDrop(report, {
          path: `header[${state.headers.length}]`,
          reason: `Malformed -H value (no colon separator): ${value}`,
          tracking: 'PERMANENT: invalid header line',
        });
      }
      return cursor + 2;
    }

    // ── Basic auth ─────────────────────────────────────────────────
    case '-u':
    case '--user': {
      const value = requireNext(tokens, cursor, token);
      state.auth = parseUserFlag(value);
      return cursor + 2;
    }

    // ── Body data ──────────────────────────────────────────────────
    case '-d':
    case '--data':
    case '--data-ascii': {
      const value = requireNext(tokens, cursor, token);
      state.dataParts.push(value);
      state.dataKind ??= 'encoded';
      return cursor + 2;
    }
    case '--data-raw':
    case '--data-binary': {
      const value = requireNext(tokens, cursor, token);
      state.dataParts.push(value);
      state.dataKind ??= 'raw';
      return cursor + 2;
    }
    case '--data-urlencode': {
      const value = requireNext(tokens, cursor, token);
      state.dataParts.push(value);
      state.dataKind ??= 'urlencoded';
      return cursor + 2;
    }

    // ── Tolerated flags (no-op but don't surprise the user) ───────
    case '--compressed':
    case '-i':
    case '--include':
    case '-v':
    case '--verbose':
    case '-s':
    case '--silent':
    case '-L':
    case '--location':
    case '-n':
    case '--netrc':
      return cursor + 1;

    // ── Multipart form parts ──────────────────────────────────────
    //
    // `-F 'field=value'`         → text part
    // `-F 'field=@path'`         → file part (placeholder FileRef —
    //                               user uploads real bytes post-import)
    // `-F 'field=@path;type=X'`  → file part with explicit MIME type
    // `-F 'field=value;type=X'`  → text part (type suffix ignored for text)
    // `-F 'field=<path'`         → curl reads the file inline as text;
    //                               we treat the same as `@` for import
    //                               purposes (placeholder, user reconciles).
    case '-F':
    case '--form': {
      const value = requireNext(tokens, cursor, token);
      const part = parseFormFlag(value, report, state.multipartParts.length);
      if (part) state.multipartParts.push(part);
      return cursor + 2;
    }
    case '-b':
    case '--cookie':
    case '-c':
    case '--cookie-jar': {
      const value = requireNext(tokens, cursor, token);
      recordDrop(report, {
        path: `flag:${token}`,
        reason: `Cookie handling is per-workspace (ARCHITECTURE §14), not per-request. Dropped value: ${value}`,
        tracking: 'PERMANENT: per-workspace cookie jar',
      });
      return cursor + 2;
    }
    case '-o':
    case '--output':
    case '-T':
    case '--upload-file':
    case '-E':
    case '--cert':
    case '--key': {
      const value = requireNext(tokens, cursor, token);
      recordDrop(report, {
        path: `flag:${token}`,
        reason: `${token} is not applicable to in-extension fetches. Dropped value: ${value}`,
        tracking: 'PERMANENT: browser-context fetch',
      });
      return cursor + 2;
    }
    case '-k':
    case '--insecure':
      recordDrop(report, {
        path: `flag:${token}`,
        reason: 'Browsers do not expose a TLS-bypass mode; this flag has no equivalent.',
        tracking: 'PERMANENT: browser TLS policy',
      });
      return cursor + 1;

    // ── Unknown flag ──────────────────────────────────────────────
    default: {
      // If the unknown flag takes an argument (starts with `-` and
      // the next token doesn't), consume both to stay in sync.
      const next = tokens[cursor + 1];
      const takesArg = typeof next === 'string' && !next.startsWith('-');
      recordDrop(report, {
        path: `flag:${token}`,
        reason: `Unrecognized flag${takesArg ? ` (with value: ${next})` : ''}. If this is important, file an issue so we can map it to the request model.`,
        tracking: '#todo-curl-coverage',
      });
      return cursor + (takesArg ? 2 : 1);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function requireNext(tokens: string[], cursor: number, flag: string): string {
  const next = tokens[cursor + 1];
  if (typeof next !== 'string') {
    throw new CurlParseError(`${flag} expects a value but reached end of input`);
  }
  return next;
}

const VALID_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function coerceMethod(value: string, report: ImportReport, flag: string): HttpMethod {
  const upper = value.toUpperCase();
  if ((VALID_METHODS as Set<string>).has(upper)) {
    return upper as HttpMethod;
  }
  recordDrop(report, {
    path: `flag:${flag}`,
    reason: `Unknown HTTP method "${value}" — defaulting to GET. Supported: GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS.`,
    tracking: 'PERMANENT: method picklist',
  });
  return 'GET';
}

function parseHeader(raw: string): { key: string; value: string } | null {
  const colon = raw.indexOf(':');
  if (colon < 0) return null;
  const key = raw.slice(0, colon).trim();
  const value = raw.slice(colon + 1).trim();
  if (key.length === 0) return null;
  return { key, value };
}

/**
 * Parse a single `-F value` segment into a MultipartPart.
 *
 * Format variants:
 *   - `field=value`              → text
 *   - `field=@path`              → file placeholder (filename = basename of path)
 *   - `field=<path`              → file placeholder (curl inlines file as text; we
 *                                   still emit a placeholder since the UI has no
 *                                   filesystem access at import time)
 *   - `...;type=X;filename=Y`    → optional semicolon-delimited parameters
 *
 * Returns `null` when the flag value is malformed (no `=` separator);
 * records an import-report entry so the user sees what slipped.
 */
function parseFormFlag(raw: string, report: ImportReport, index: number): MultipartPart | null {
  const eq = raw.indexOf('=');
  if (eq < 0) {
    recordDrop(report, {
      path: `flag:-F[${index}]`,
      reason: `Malformed -F value (no '=' separator): ${raw}`,
      tracking: 'PERMANENT: invalid -F line',
    });
    return null;
  }
  const name = raw.slice(0, eq);
  const rest = raw.slice(eq + 1);
  // Split off `;type=X;filename=Y` parameters. `=` inside the payload
  // is fine — we only split at the FIRST `;` that sits OUTSIDE the
  // value prefix.
  const { value: rawValue, params } = splitFormSuffix(rest);
  const mimeType = params.get('type');
  const filenameOverride = params.get('filename');

  // curl prefixes file references with `@` (read bytes) or `<` (read
  // as text). Either way, an import boundary has no filesystem
  // access, so the importer emits a placeholder FileRef. The user
  // replaces it post-import through the multipart body editor.
  if (rawValue.startsWith('@') || rawValue.startsWith('<')) {
    const path = rawValue.slice(1);
    const basenameFromPath = basename(path) || 'unnamed';
    // Prefer the explicit `filename=…` param (curl's user-level rename
    // feature) as the display filename on the placeholder; falls back
    // to the filename inferred from the path.
    const displayFilename = filenameOverride ?? basenameFromPath;
    const fileRef = placeholderFileRef({ filename: displayFilename, mimeType });
    recordTransform(report, {
      path: `flag:-F[${index}]`,
      from: `${name}=${rawValue.startsWith('@') ? '@' : '<'}${path}`,
      to: `multipart.file (${displayFilename})`,
      reason: `File part imported as a placeholder. Upload the real file via the request editor's multipart view to complete reconciliation.`,
      tracking: '#todo-file-blobs',
    });
    return { kind: 'file', uid: generateUid(), name, fileRefs: [fileRef] };
  }

  return { kind: 'text', uid: generateUid(), name, value: rawValue };
}

function splitFormSuffix(rest: string): { value: string; params: Map<string, string> } {
  const params = new Map<string, string>();
  const semi = rest.indexOf(';');
  if (semi < 0) return { value: rest, params };
  // Parameter form: `value;k=v;k=v`. curl's own grammar is looser (it
  // tolerates quoted values etc.) — we handle the common case and
  // pass the rest through as-is.
  const value = rest.slice(0, semi);
  const tail = rest.slice(semi + 1);
  for (const segment of tail.split(';')) {
    const kvSep = segment.indexOf('=');
    if (kvSep < 0) continue;
    const k = segment.slice(0, kvSep).trim().toLowerCase();
    let v = segment.slice(kvSep + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    params.set(k, v);
  }
  return { value, params };
}

function basename(path: string): string {
  const cleaned = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = cleaned.lastIndexOf('/');
  return slash < 0 ? cleaned : cleaned.slice(slash + 1);
}

function parseUserFlag(value: string): AuthConfig {
  // curl accepts `user:pass`; if no `:` is present it treats the
  // whole value as the username and prompts for the password. We
  // import the username and leave the password blank — the user
  // can fill it in the editor.
  const colon = value.indexOf(':');
  if (colon < 0) {
    return { type: 'basic', username: value, password: '' };
  }
  return {
    type: 'basic',
    username: value.slice(0, colon),
    password: value.slice(colon + 1),
  };
}
