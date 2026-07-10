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

  // --json pins the body type and carries the two headers curl itself
  // puts on the wire (when the paste didn't already include them).
  if (state.jsonBody) {
    if (!contentTypeOf(outHeaders)) {
      outHeaders.push({ uid: generateUid(), key: 'Content-Type', value: 'application/json' });
    }
    if (!outHeaders.some((h) => h.key.toLowerCase() === 'accept')) {
      outHeaders.push({ uid: generateUid(), key: 'Accept', value: 'application/json' });
    }
  }

  // Body: `-F` overrides `-d` (curl itself rejects mixing them; we
  // take the richer shape and emit a report entry if we found both).
  // `-G` moves the data parts into the query string, per curl.
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
  } else if (state.forceGet && state.dataParts.length > 0) {
    const moved = dataPartsAsFields(state.dataParts, state.dataKind, report);
    for (const field of moved) {
      params.push({ uid: generateUid(), key: field.key, value: field.value });
    }
    recordTransform(report, {
      path: 'body',
      from: `-d ×${state.dataParts.length}`,
      to: `query params ×${moved.length}`,
      reason: '-G/--get sends the data as a query string, so the parts land as query params instead of a body.',
      tracking: 'PERMANENT: curl -G semantics',
    });
    body = { type: 'none' };
  } else {
    // Decide body.type from Content-Type header (json wins for
    // application/json); with no header, infer — JSON-shaped content
    // lands on the JSON tab, and `-d` payloads land as structured
    // form fields (curl's own default wire encoding).
    body = buildBody(state.dataParts, state.dataKind, outHeaders, report, state.jsonBody);
  }

  // Method inference: if the user passed `-d` or `-F` with no `-X`,
  // curl sends POST. Honor that so imported requests don't silently
  // fire a GET with a body attached. `-G` reverts to GET.
  const hasBody = body.type !== 'none';
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

function buildBody(
  parts: string[],
  kind: ParserState['dataKind'],
  headers: RequestHeader[],
  report: ImportReport,
  jsonPinned: boolean,
): RequestBody {
  if (parts.length === 0) {
    return { type: 'none' };
  }
  // `--data-urlencode` is per-field: each flag is one key=value pair
  // whose value stays literal (curl encodes it on the wire). Joining
  // then re-splitting would corrupt values containing `&`/`=`.
  if (kind === 'urlencoded') {
    const fields: Array<{ uid: string; key: string; value: string }> = [];
    for (let i = 0; i < parts.length; i++) {
      const field = parseUrlencodePart(parts[i], report, i);
      if (field) fields.push({ uid: generateUid(), ...field });
    }
    return { type: 'form', formParts: fields };
  }
  // curl semantics: `-d` joins multiple with `&`, `--data-raw`
  // concatenates verbatim. We pick the less-destructive join: `&`
  // when the first flag was form-ish, otherwise newline.
  const content = kind === 'raw' ? parts.join('\n') : parts.join('&');
  if (jsonPinned) {
    return { type: 'json', content };
  }
  const contentType = contentTypeOf(headers);
  if (contentType) {
    if (/\bapplication\/json\b/i.test(contentType)) {
      return { type: 'json', content };
    }
    // form-urlencoded Content-Type → split into structured form fields
    // so the editor's form-urlencoded tab renders rows. Sending a curl
    // request with `-d 'a=1&b=2' -H 'Content-Type: application/x-www-form-urlencoded'`
    // is the canonical shape we want the user to land on.
    if (/application\/x-www-form-urlencoded/i.test(contentType)) {
      return { type: 'form', formParts: parseFormFields(content) };
    }
    return { type: 'text', content };
  }
  // No Content-Type on the paste — infer. JSON-shaped content means
  // the user's intent is a JSON body regardless of what curl would
  // put on the wire; otherwise `-d` payloads follow curl's default
  // form-urlencoded encoding.
  if (looksLikeJson(content)) {
    recordTransform(report, {
      path: 'body',
      from: 'text',
      to: 'json',
      reason: 'No Content-Type header; the body parses as JSON, so it lands on the JSON editor tab.',
      tracking: 'PERMANENT: body-type inference',
    });
    return { type: 'json', content };
  }
  if (kind === 'encoded') {
    recordTransform(report, {
      path: 'body',
      from: 'text',
      to: 'form',
      reason: 'No Content-Type header; curl sends -d payloads form-urlencoded, so the body lands as structured form fields.',
      tracking: 'PERMANENT: body-type inference',
    });
    return { type: 'form', formParts: parseFormFields(content) };
  }
  return { type: 'text', content };
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * One `--data-urlencode` flag value → one form field. curl's grammar:
 * `name=content` / `=content` / `content` are literal content (encoded
 * by curl on the wire); `name@file` / `@file` read from disk, which an
 * import boundary can't do — those drop with a report entry.
 */
function parseUrlencodePart(
  raw: string,
  report: ImportReport,
  index: number,
): { key: string; value: string } | null {
  const eq = raw.indexOf('=');
  const at = raw.indexOf('@');
  if (eq < 0 && at >= 0) {
    recordDrop(report, {
      path: `flag:--data-urlencode[${index}]`,
      reason: `File-reading form (${raw}) needs filesystem access, which imports don't have. Enter the value in the editor instead.`,
      tracking: 'PERMANENT: browser-context fetch',
    });
    return null;
  }
  if (eq < 0) {
    return { key: '', value: raw };
  }
  return { key: raw.slice(0, eq), value: raw.slice(eq + 1) };
}

/**
 * `-G` support: data parts become query-param fields. Urlencoded parts
 * are per-field literals; `-d`/raw parts join with `&` and split with
 * percent-decoding, mirroring what curl appends to the URL.
 */
function dataPartsAsFields(
  parts: string[],
  kind: ParserState['dataKind'],
  report: ImportReport,
): Array<{ key: string; value: string }> {
  if (kind === 'urlencoded') {
    const fields: Array<{ key: string; value: string }> = [];
    for (let i = 0; i < parts.length; i++) {
      const field = parseUrlencodePart(parts[i], report, i);
      if (field) fields.push(field);
    }
    return fields;
  }
  return parseFormFields(parts.join('&')).map(({ key, value }) => ({ key, value }));
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
