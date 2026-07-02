import type { AuthConfig, HttpMethod, QueryParam, RequestBody, RequestHeader } from '../../types/request';
import { decodeBase64 } from '../../utils/base64';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { ParserState } from './state';
import { CurlParseError, type CurlRequest } from './types';

// ── Finalize: fold parser state into a request ──────────────────

export function finalize(state: ParserState, report: ImportReport): CurlRequest {
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
    const decoded = decodeBase64(b64);
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
