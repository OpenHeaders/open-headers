/**
 * curl import — parse a `curl` command-line string into a Request
 * + an ImportReport describing drops / transforms.
 *
 * Scope (v1, ARCHITECTURE.md §23):
 *   • Method: `-X` / `--request`; POST inferred when `-d`/`--data*`
 *     is present without an explicit method.
 *   • URL: first non-flag positional arg, or `--url`. Query-string is
 *     extracted into `params`.
 *   • Headers: `-H` / `--header` (repeatable).
 *   • Body: `-d` / `--data` / `--data-raw` / `--data-binary` /
 *     `--data-urlencode` / `--data-ascii` (first wins; repeated
 *     entries join with `&`). Content-Type header governs body.type
 *     (json / text).
 *   • Basic auth: `-u user:pass`. Bearer via
 *     `Authorization: Bearer <x>` header is promoted to `auth.type`.
 *   • Noop / tolerated: `--compressed`, `-i`, `--include`, `-v`,
 *     `--verbose`, `-s`, `--silent`, `-L`, `--location`.
 *
 * Dropped (with report entry):
 *   • `--form` / `-F` (multipart) — tracked; v2 once file-blob
 *     storage lands (§6).
 *   • `--cookie` / `-b`, `--cookie-jar` / `-c` — cookie policy is
 *     per-workspace (§14), not per-request.
 *   • `--output` / `-o`, `--upload-file` / `-T`, `--cert`, `--key`,
 *     `-E` — out of scope for an extension-context fetch.
 *   • `--insecure` / `-k` — the browser does not expose a TLS bypass.
 *
 * The tokenizer is POSIX-sh aware: single quotes preserve everything
 * literally; double quotes allow backslash escapes; `$'...'` (bash
 * ANSI-C) is collapsed to `'...'` literal semantics; bare backslash
 * at end-of-line joins lines (common in multi-line curl pastes).
 */

import { placeholderFileRef } from '../files';
import { generateUid } from '../utils/workspace';
import type {
  AuthConfig,
  HttpMethod,
  MultipartPart,
  QueryParam,
  RequestBody,
  RequestHeader,
} from '../types/request';
import { createReport, type ImportReport, recordDrop, recordTransform } from './report';

export interface CurlRequest {
  name: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  params: QueryParam[];
  auth: AuthConfig;
  body: RequestBody;
}

export interface CurlParseResult {
  request: CurlRequest;
  report: ImportReport;
}

export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurlParseError';
  }
}

// ── Entry point ─────────────────────────────────────────────────────

export function parseCurl(input: string): CurlParseResult {
  const report = createReport('curl');
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new CurlParseError('empty input — nothing to parse');
  }

  // Accept either a bare curl command or a raw command string. Shell
  // pastes often wrap the command in a trailing newline / whitespace.
  let cursor = 0;
  if (tokens[0] === 'curl' || tokens[0]?.startsWith('curl')) {
    // "curl" literal, or something like "curl.exe" — just skip one token.
    cursor = 1;
  }

  const state: ParserState = {
    method: null,
    url: null,
    headers: [],
    dataParts: [],
    dataKind: null,
    auth: null,
    multipartParts: [],
  };

  while (cursor < tokens.length) {
    const token = tokens[cursor];
    cursor = consumeToken(token, tokens, cursor, state, report);
  }

  return { request: finalize(state, report), report };
}

// ── Parser state ────────────────────────────────────────────────────

interface ParserState {
  method: HttpMethod | null;
  url: string | null;
  headers: Array<{ key: string; value: string }>;
  /**
   * Accumulated body parts. Multiple `-d` flags on a single command
   * are joined with `&` — that's the curl convention. Later we map
   * that to a single body.content string.
   */
  dataParts: string[];
  /**
   * Kind of the first data flag that was seen. `raw` = no URL
   * encoding applied, `encoded` = URL-encoded (`-d`), `urlencoded`
   * = `--data-urlencode` (we pass the raw string through — curl's
   * actual behavior is more nuanced but for imported requests users
   * expect their body to land as-entered).
   */
  dataKind: 'raw' | 'encoded' | 'urlencoded' | null;
  auth: AuthConfig | null;
  /**
   * Multipart parts assembled from `-F` / `--form` flags. Text
   * fields (`key=value`) map to `{kind: 'text'}`; file fields
   * (`key=@path`) map to `{kind: 'file'}` with a PLACEHOLDER FileRef
   * (filename taken from the path). The user reconciles the
   * placeholder after import via the multipart body editor's
   * "Upload" button.
   */
  multipartParts: MultipartPart[];
}

// ── Token dispatch ──────────────────────────────────────────────────

function consumeToken(
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

// ── Finalize: fold parser state into a request ──────────────────

function finalize(state: ParserState, report: ImportReport): CurlRequest {
  if (state.url === null) {
    throw new CurlParseError('no URL found in curl command');
  }

  const { base, params } = splitUrl(state.url);
  const name = deriveName(base);

  // Auth-header promotion: Authorization: Bearer / Basic headers get
  // folded into auth. Record a transform so the user knows the header
  // was removed (it would otherwise double-apply at send time).
  let auth: AuthConfig = state.auth ?? { type: 'none' };
  const outHeaders: RequestHeader[] = [];
  for (const h of state.headers) {
    if (h.key.toLowerCase() === 'authorization' && state.auth === null) {
      const promoted = tryPromoteAuthHeader(h.value);
      if (promoted) {
        auth = promoted;
        recordTransform(report, {
          path: `header[${outHeaders.length}]`,
          from: `Authorization: ${redactToken(h.value)}`,
          to: `auth.${promoted.type}`,
          reason: `Promoted Authorization header to a first-class auth type so it surfaces in the Auth tab instead of the raw Headers list.`,
          tracking: 'PERMANENT: §18 first-class auth',
        });
        continue;
      }
    }
    outHeaders.push({ uid: generateUid(), key: h.key, value: h.value });
  }

  // Body: `-F` overrides `-d` (curl itself rejects mixing them; we
  // take the richer shape and emit a report entry if we found both).
  // Otherwise join repeated data parts per curl's convention.
  let body: RequestBody;
  if (state.multipartParts.length > 0) {
    if (state.dataParts.length > 0) {
      recordDrop(report, {
        path: 'body',
        reason: `Combined -F and -d/--data flags — curl rejects this. Kept the -F parts; dropped the -d payload: ${state.dataParts.join(', ').slice(0, 120)}`,
        tracking: 'PERMANENT: curl rejects -F+-d',
      });
    }
    body = { type: 'multipart', multipartParts: state.multipartParts };
  } else {
    // Decide body.type from Content-Type header (json wins for
    // application/json); everything else falls back to `text`. The
    // executor encodes `json` bodies as `application/json` on the
    // wire, so the user's ergonomic expectation is preserved.
    body = buildBody(state.dataParts, state.dataKind, outHeaders);
  }

  // Method inference: if the user passed `-d` or `-F` with no `-X`,
  // curl sends POST. Honor that so imported requests don't silently
  // fire a GET with a body attached.
  const hasBody = state.dataParts.length > 0 || state.multipartParts.length > 0;
  const method: HttpMethod = state.method ?? (hasBody ? 'POST' : 'GET');

  return {
    name,
    method,
    url: base,
    headers: outHeaders,
    params,
    auth,
    body,
  };
}

function splitUrl(raw: string): { base: string; params: QueryParam[] } {
  const hashIndex = raw.indexOf('#');
  const withoutFragment = hashIndex < 0 ? raw : raw.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex < 0) {
    return { base: withoutFragment, params: [] };
  }
  const base = withoutFragment.slice(0, queryIndex);
  const query = withoutFragment.slice(queryIndex + 1);
  const params: QueryParam[] = [];
  for (const entry of query.split('&')) {
    if (entry.length === 0) continue;
    const eq = entry.indexOf('=');
    if (eq < 0) {
      params.push({ uid: generateUid(), key: safeDecode(entry), value: '' });
    } else {
      params.push({
        uid: generateUid(),
        key: safeDecode(entry.slice(0, eq)),
        value: safeDecode(entry.slice(eq + 1)),
      });
    }
  }
  return { base, params };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function deriveName(base: string): string {
  try {
    const parsed = new URL(base);
    const host = parsed.host;
    const path = parsed.pathname.replace(/\/$/, '');
    return path ? `${host}${path}` : host;
  } catch {
    // URL constructor chokes on `{{VAR}}` and other non-standard
    // templates. Fall back to the raw string up to the first query
    // char — good enough for a default tab label.
    const cleaned = base.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
    return cleaned || 'Imported request';
  }
}

function tryPromoteAuthHeader(value: string): AuthConfig | null {
  const trimmed = value.trim();
  if (/^Bearer\s+/i.test(trimmed)) {
    return { type: 'bearer', token: trimmed.replace(/^Bearer\s+/i, '') };
  }
  if (/^Basic\s+/i.test(trimmed)) {
    const b64 = trimmed.replace(/^Basic\s+/i, '');
    const decoded = safeBase64Decode(b64);
    if (decoded?.includes(':')) {
      const colon = decoded.indexOf(':');
      return {
        type: 'basic',
        username: decoded.slice(0, colon),
        password: decoded.slice(colon + 1),
      };
    }
  }
  return null;
}

function safeBase64Decode(value: string): string | null {
  try {
    return typeof atob === 'function' ? atob(value) : Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** Mask everything after the scheme when logging auth-header transforms. */
function redactToken(value: string): string {
  const match = /^(Bearer|Basic)\s+/i.exec(value);
  if (!match) return '***';
  return `${match[1]} ***`;
}

function buildBody(parts: string[], kind: ParserState['dataKind'], headers: RequestHeader[]): RequestBody {
  if (parts.length === 0) {
    return { type: 'none' };
  }
  // curl semantics: `-d` joins multiple with `&`, `--data-raw`
  // concatenates verbatim. We pick the less-destructive join: `&`
  // when the first flag was form-ish, otherwise newline.
  const content = kind === 'raw' ? parts.join('\n') : parts.join('&');
  const contentType = contentTypeOf(headers);
  if (contentType && /\bapplication\/json\b/i.test(contentType)) {
    return { type: 'json', content };
  }
  // form-urlencoded Content-Type → split into structured form fields
  // so the editor's form-urlencoded tab renders rows. Sending a curl
  // request with `-d 'a=1&b=2' -H 'Content-Type: application/x-www-form-urlencoded'`
  // is the canonical shape we want the user to land on.
  if (contentType && /application\/x-www-form-urlencoded/i.test(contentType)) {
    return { type: 'form', formParts: parseFormFields(content) };
  }
  return { type: 'text', content };
}

function parseFormFields(encoded: string): Array<{ uid: string; key: string; value: string }> {
  if (!encoded) return [];
  const out: Array<{ uid: string; key: string; value: string }> = [];
  for (const segment of encoded.split('&')) {
    if (segment.length === 0) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq < 0 ? segment : segment.slice(0, eq);
    const rawValue = eq < 0 ? '' : segment.slice(eq + 1);
    out.push({
      uid: generateUid(),
      key: safeDecode(rawKey.replace(/\+/g, ' ')),
      value: safeDecode(rawValue.replace(/\+/g, ' ')),
    });
  }
  return out;
}

function contentTypeOf(headers: readonly RequestHeader[]): string | null {
  for (const h of headers) {
    if (h.key.toLowerCase() === 'content-type') return h.value;
  }
  return null;
}

// ── Tokenizer ───────────────────────────────────────────────────────
//
// Purpose-built for curl command lines pasted from DevTools / docs:
// POSIX sh quoting rules (single-quotes literal, double-quotes with
// backslash escapes), `$'...'` ANSI-C quoting treated as `'...'`,
// backslash-newline line continuation. Keep this narrow — we don't
// support shell variable expansion, command substitution, or
// anything else that would require a real parser.

const WHITESPACE = /\s/;

export function tokenize(input: string): string[] {
  // Collapse line continuations first so the main scanner doesn't
  // have to track them. curl pastes often break across lines with
  // `\` at EOL.
  const normalized = input.replace(/\\\r?\n/g, ' ').replace(/\r\n/g, '\n');
  const tokens: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (WHITESPACE.test(ch)) {
      i += 1;
      continue;
    }
    const [token, next] = readToken(normalized, i);
    tokens.push(token);
    i = next;
  }
  return tokens;
}

function readToken(src: string, start: number): [string, number] {
  let i = start;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (WHITESPACE.test(ch)) break;
    if (ch === '\\' && i + 1 < src.length) {
      // Backslash escape outside quotes — take next char literally.
      out += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '$' && src[i + 1] === "'") {
      // $'...' ANSI-C quoting — treat the inside as a literal (no
      // ANSI escapes). Sufficient for common curl pastes.
      const [inside, after] = readSingleQuoted(src, i + 2);
      out += inside;
      i = after;
      continue;
    }
    if (ch === "'") {
      const [inside, after] = readSingleQuoted(src, i + 1);
      out += inside;
      i = after;
      continue;
    }
    if (ch === '"') {
      const [inside, after] = readDoubleQuoted(src, i + 1);
      out += inside;
      i = after;
      continue;
    }
    out += ch;
    i += 1;
  }
  return [out, i];
}

function readSingleQuoted(src: string, start: number): [string, number] {
  let i = start;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'") return [out, i + 1];
    out += ch;
    i += 1;
  }
  // Unterminated quote: accept what we have rather than throwing —
  // shell pastes sometimes arrive truncated.
  return [out, i];
}

function readDoubleQuoted(src: string, start: number): [string, number] {
  let i = start;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') return [out, i + 1];
    if (ch === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      // Only a handful of shell-standard escapes are honored inside
      // double quotes; everything else preserves the backslash.
      if (next === '"' || next === '\\' || next === '$' || next === '`') {
        out += next;
        i += 2;
        continue;
      }
      if (next === 'n') {
        out += '\n';
        i += 2;
        continue;
      }
      if (next === 't') {
        out += '\t';
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return [out, i];
}
