/**
 * HAR (HTTP Archive) import — parse a HAR 1.2 JSON document into
 * V5-request-shaped entries + one `ImportReport` covering the whole
 * file.
 *
 * HAR is JSON — `log.entries` is an array where every entry carries a
 * `request` and a `response`. We map `request` only (V5 requests are
 * authoring-side; response bodies from the original capture are not
 * persisted in the workspace model). Many entries per file is the
 * norm — the caller presents a selection UI and invokes `parseHar` +
 * `selectHarEntries` to narrow down before writing.
 *
 * Scope (v1):
 *   • Required HAR 1.2 fields: `log.version`, `log.entries[*].request
 *     .method`, `.url`, `.headers`, `.queryString`.
 *   • Optional, supported: `request.postData.{mimeType, text}` →
 *     body; `Authorization` header promotion (Bearer / Basic base64);
 *     `request.cookies` → dropped with report entry (per-workspace
 *     cookie policy, §14).
 *
 * Dropped (logged):
 *   • `request.postData.params` (form fields) without an aggregate
 *     `text` field — HAR permits either representation; the form-
 *     field array needs URL-encoding we don't want to guess.
 *   • `request.postData.mimeType: multipart/form-data` — same gap as
 *     curl's `-F`: binary payloads require content-addressed storage
 *     (§6).
 *   • `response.*` — HAR responses aren't part of the V5 request
 *     model (auth tokens / test runs live elsewhere); importing them
 *     silently would leak capture artifacts into authoring data.
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
import type { CurlRequest } from './curl';
import { createReport, type ImportReport, recordDrop, recordTransform } from './report';

// ── Types we actually read (subset of the full HAR 1.2 schema) ────

interface HarFile {
  log?: {
    version?: string;
    entries?: HarEntry[];
  };
}

interface HarEntry {
  request?: HarRequest;
}

interface HarRequest {
  method?: string;
  url?: string;
  httpVersion?: string;
  headers?: Array<{ name: string; value: string }>;
  queryString?: Array<{ name: string; value: string }>;
  cookies?: Array<{ name: string; value: string }>;
  postData?: {
    mimeType?: string;
    text?: string;
    params?: Array<{ name: string; value?: string; fileName?: string; contentType?: string }>;
  };
}

// ── Output shapes ───────────────────────────────────────────────────

/**
 * One HAR entry rendered as an authoring-ready V5 request + the
 * index it came from in the source file (stable across selection UI
 * toggles so the selector doesn't care about sort order).
 */
export interface HarParsedEntry {
  index: number;
  request: CurlRequest;
}

export interface HarParseResult {
  entries: HarParsedEntry[];
  report: ImportReport;
}

export class HarParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HarParseError';
  }
}

// ── Entry point ─────────────────────────────────────────────────────

/**
 * Parse the raw text of a HAR file. Throws `HarParseError` when the
 * input isn't valid JSON or doesn't look like HAR. Malformed
 * individual entries are dropped (with a report entry) rather than
 * failing the whole import — most HAR exports contain noise rows
 * (OCSP checks, favicon fetches) that aren't worth blocking the
 * import over.
 */
export function parseHar(input: string): HarParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new HarParseError(`HAR is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new HarParseError('HAR must be a JSON object with a `log` field');
  }
  const file = parsed as HarFile;
  if (!file.log || typeof file.log !== 'object') {
    throw new HarParseError('HAR is missing the `log` field (expected HAR 1.2)');
  }
  const entries = Array.isArray(file.log.entries) ? file.log.entries : [];

  const report = createReport('har', entries.length);
  // Counter tracks how many entries actually landed as parsed
  // requests — starts optimistic (= total entries) and decrements on
  // drop so the summary reflects reality.
  let imported = entries.length;

  const out: HarParsedEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const req = entries[i]?.request;
    if (!req || typeof req !== 'object') {
      recordDrop(report, {
        path: `log.entries[${i}]`,
        reason: `Entry is missing the \`request\` field — skipped.`,
        tracking: 'PERMANENT: HAR shape validation',
      });
      imported -= 1;
      continue;
    }
    const result = tryConvertEntry(req, i, report);
    if (result === null) {
      imported -= 1;
      continue;
    }
    out.push({ index: i, request: result });
  }

  report.summary = { ...report.summary, imported: Math.max(0, imported) };
  return { entries: out, report };
}

/**
 * Narrow a parsed HAR result to a subset of entries (by original
 * index). Used by the selection modal: after `parseHar`, the user
 * checks the entries they want; we keep only those before writing.
 * The report keeps every drop/transform from the original parse —
 * those reflect the SOURCE's lossiness, not the user's selection.
 */
export function selectHarEntries(result: HarParseResult, indices: readonly number[]): HarParseResult {
  const keep = new Set(indices);
  const entries = result.entries.filter((e) => keep.has(e.index));
  return {
    entries,
    report: { ...result.report, summary: { ...result.report.summary, imported: entries.length } },
  };
}

// ── Per-entry conversion ────────────────────────────────────────────

const VALID_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function tryConvertEntry(req: HarRequest, index: number, report: ImportReport): CurlRequest | null {
  const rawUrl = typeof req.url === 'string' ? req.url : '';
  if (rawUrl.length === 0) {
    recordDrop(report, {
      path: `log.entries[${index}].request.url`,
      reason: 'Entry has no URL — skipped.',
      tracking: 'PERMANENT: HAR shape validation',
    });
    return null;
  }

  const method = coerceMethod(req.method, index, report);
  const { base, params: urlParams } = splitUrl(rawUrl);

  // Query-string fields live in two places per HAR 1.2: the URL's
  // own `?k=v&…` AND the structured `queryString` array. Most HAR
  // exporters duplicate them. We prefer the URL-derived list (source
  // of truth) and log a transform if the arrays disagree in content.
  const structuredParams: QueryParam[] = Array.isArray(req.queryString)
    ? req.queryString.map((p) => ({ uid: generateUid(), key: String(p.name ?? ''), value: String(p.value ?? '') }))
    : [];
  const params = pickAuthoritativeParams(urlParams, structuredParams, index, report);

  const rawHeaders: Array<{ key: string; value: string }> = Array.isArray(req.headers)
    ? req.headers.map((h) => ({ key: String(h.name ?? ''), value: String(h.value ?? '') }))
    : [];

  // HAR convention: pseudo-headers (`:method`, `:path`, `:authority`,
  // `:scheme`) are HTTP/2 wire artifacts. They're meaningless in an
  // authoring context — the method and URL are already top-level
  // fields. Strip silently; log one aggregate transform if any are
  // present so the user sees what happened.
  const { kept: headersWithoutPseudo, stripped } = stripPseudoHeaders(rawHeaders);
  if (stripped > 0) {
    recordTransform(report, {
      path: `log.entries[${index}].request.headers`,
      from: `${stripped} pseudo-header${stripped === 1 ? '' : 's'}`,
      to: 'removed',
      reason:
        'HTTP/2 pseudo-headers (`:method`, `:path`, etc.) are wire artifacts; the V5 request already carries method + URL as first-class fields.',
      tracking: 'PERMANENT: §HTTP/2 pseudo-header discipline',
    });
  }

  // Auth-header promotion — identical shape to curl's flow. Keep
  // both importers aligned so users see the same Auth behavior
  // regardless of source.
  const { auth, headers: finalHeaders } = promoteAuthHeader(headersWithoutPseudo, index, report);

  // Body: `postData.text` is the canonical form; `postData.params`
  // is the alternate (url-encoded fields or multipart). We support
  // text; log a drop for the alternate cases the user can address
  // downstream.
  const body = buildBody(req.postData, finalHeaders, index, report);

  // Cookies in HAR's `request.cookies` are the browser's captured
  // state at request time — they're NOT intended to be replayed
  // from an authoring tool (our per-workspace jar discipline, §14).
  if (Array.isArray(req.cookies) && req.cookies.length > 0) {
    recordDrop(report, {
      path: `log.entries[${index}].request.cookies`,
      reason: `${req.cookies.length} cookie${req.cookies.length === 1 ? '' : 's'} dropped — cookie handling is per-workspace (§14), not per-request.`,
      tracking: 'PERMANENT: per-workspace cookie jar',
    });
  }

  const name = deriveName(base, method);

  return {
    name,
    method,
    url: base,
    headers: finalHeaders,
    params,
    auth,
    body,
  };
}

function coerceMethod(raw: string | undefined, index: number, report: ImportReport): HttpMethod {
  if (typeof raw !== 'string') {
    recordDrop(report, {
      path: `log.entries[${index}].request.method`,
      reason: 'Method missing — defaulting to GET.',
      tracking: 'PERMANENT: HAR shape validation',
    });
    return 'GET';
  }
  const upper = raw.toUpperCase();
  if ((VALID_METHODS as Set<string>).has(upper)) return upper as HttpMethod;
  recordDrop(report, {
    path: `log.entries[${index}].request.method`,
    reason: `Unknown HTTP method "${raw}" — defaulting to GET.`,
    tracking: 'PERMANENT: method picklist',
  });
  return 'GET';
}

function splitUrl(raw: string): { base: string; params: QueryParam[] } {
  const hashIndex = raw.indexOf('#');
  const withoutFragment = hashIndex < 0 ? raw : raw.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf('?');
  if (queryIndex < 0) return { base: withoutFragment, params: [] };
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

function pickAuthoritativeParams(
  fromUrl: QueryParam[],
  fromArray: QueryParam[],
  index: number,
  report: ImportReport,
): QueryParam[] {
  // If both present, we trust the URL. Log a transform if the
  // structured array provides keys the URL missed (unusual but
  // possible — exporter bugs or manually-edited HARs).
  if (fromUrl.length > 0) {
    const urlKeys = new Set(fromUrl.map((p) => p.key));
    const extras = fromArray.filter((p) => !urlKeys.has(p.key));
    if (extras.length > 0) {
      recordTransform(report, {
        path: `log.entries[${index}].request.queryString`,
        from: `${fromArray.length} structured entries`,
        to: `${fromUrl.length} derived from URL`,
        reason: `URL query string is authoritative. ${extras.length} extra structured entr${extras.length === 1 ? 'y' : 'ies'} not found in the URL were ignored.`,
        tracking: 'PERMANENT: URL is source of truth',
      });
    }
    return fromUrl;
  }
  return fromArray;
}

function stripPseudoHeaders(headers: Array<{ key: string; value: string }>): {
  kept: RequestHeader[];
  stripped: number;
} {
  const kept: RequestHeader[] = [];
  let stripped = 0;
  for (const h of headers) {
    if (h.key.startsWith(':')) {
      stripped += 1;
      continue;
    }
    kept.push({ uid: generateUid(), key: h.key, value: h.value });
  }
  return { kept, stripped };
}

function promoteAuthHeader(
  headers: RequestHeader[],
  index: number,
  report: ImportReport,
): { auth: AuthConfig; headers: RequestHeader[] } {
  const out: RequestHeader[] = [];
  let auth: AuthConfig = { type: 'none' };
  for (const h of headers) {
    if (h.key.toLowerCase() === 'authorization' && auth.type === 'none') {
      const promoted = tryPromoteAuthHeader(h.value);
      if (promoted) {
        auth = promoted;
        recordTransform(report, {
          path: `log.entries[${index}].request.headers`,
          from: `Authorization: ${redactToken(h.value)}`,
          to: `auth.${promoted.type}`,
          reason: 'Promoted Authorization header to a first-class auth type so it surfaces in the Auth tab.',
          tracking: 'PERMANENT: §18 first-class auth',
        });
        continue;
      }
    }
    out.push(h);
  }
  return { auth, headers: out };
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

function redactToken(value: string): string {
  const match = /^(Bearer|Basic)\s+/i.exec(value);
  if (!match) return '***';
  return `${match[1]} ***`;
}

function buildBody(
  postData: HarRequest['postData'],
  headers: RequestHeader[],
  index: number,
  report: ImportReport,
): RequestBody {
  if (!postData) return { type: 'none' };

  const mime = (postData.mimeType ?? '').toLowerCase();
  const text = typeof postData.text === 'string' ? postData.text : '';

  // Multipart: reconcile into a V5 multipart body. HAR exports a
  // `params[]` list where text parts carry `value` and file parts
  // carry `fileName + contentType` (bytes are NOT preserved in HAR
  // — browsers only record the multipart field metadata). Text
  // parts land as-is; file parts land as PLACEHOLDERS that the user
  // resolves in the multipart body editor.
  if (mime.startsWith('multipart/form-data')) {
    const params = Array.isArray(postData.params) ? postData.params : [];
    const parts: MultipartPart[] = [];
    let filePlaceholderCount = 0;
    for (const p of params) {
      const name = typeof p.name === 'string' ? p.name : '';
      if (typeof p.fileName === 'string' && p.fileName.length > 0) {
        parts.push({
          kind: 'file',
          uid: generateUid(),
          name,
          fileRefs: [placeholderFileRef({ filename: p.fileName, mimeType: p.contentType })],
        });
        filePlaceholderCount += 1;
        continue;
      }
      parts.push({ kind: 'text', uid: generateUid(), name, value: typeof p.value === 'string' ? p.value : '' });
    }
    if (filePlaceholderCount > 0) {
      recordTransform(report, {
        path: `log.entries[${index}].request.postData`,
        from: `multipart with ${filePlaceholderCount} file part${filePlaceholderCount === 1 ? '' : 's'}`,
        to: 'multipart with placeholder FileRefs',
        reason: `HAR does not record multipart file bytes. File parts imported as placeholders — open the request editor's Body tab to upload the real files.`,
        tracking: '#todo-file-blobs',
      });
    }
    return { type: 'multipart', multipartParts: parts };
  }

  // No text but params present: url-encoded form rendered as an
  // array. HAR captures these structurally — promote each param to a
  // form field directly so the editor's form-urlencoded tab renders
  // them as rows (no roundtrip through encoded text).
  if (text.length === 0 && Array.isArray(postData.params) && postData.params.length > 0) {
    const formParts = postData.params
      .filter((p) => typeof p.name === 'string')
      .map((p) => ({
        uid: generateUid(),
        key: p.name,
        value: typeof p.value === 'string' ? p.value : '',
      }));
    return { type: 'form', formParts };
  }

  if (text.length === 0) return { type: 'none' };

  // Pick V5 body type from the content-type (header first, falling
  // back to postData.mimeType since some HAR exporters set one but
  // not the other).
  const contentType = contentTypeOf(headers) ?? mime;
  if (/application\/json/i.test(contentType)) return { type: 'json', content: text };
  if (/application\/xml|text\/xml/i.test(contentType)) return { type: 'xml', content: text };
  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    return { type: 'form', formParts: parseFormFieldsFromUrlEncoded(text) };
  }
  return { type: 'text', content: text };
}

function parseFormFieldsFromUrlEncoded(encoded: string): Array<{ uid: string; key: string; value: string }> {
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

function deriveName(base: string, method: HttpMethod): string {
  try {
    const parsed = new URL(base);
    const host = parsed.host;
    const path = parsed.pathname.replace(/\/$/, '');
    const suffix = path ? `${host}${path}` : host;
    return `${method} ${suffix}`;
  } catch {
    return `${method} ${base.replace(/^https?:\/\//, '').replace(/[?#].*$/, '')}`;
  }
}
