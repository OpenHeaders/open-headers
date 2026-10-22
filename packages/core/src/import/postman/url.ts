import type { PathParam, QueryParam } from '../../types/request';
import { parsePathParamNames } from '../../utils/url';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { PostmanUrl } from './types';

// ── URL handling ────────────────────────────────────────────────────

/** A Postman URL read into the request's URL text plus its Path
 *  Parameters rows (`url.variable[]`, the vendor's "path variables"). */
export interface PostmanReadUrl {
  url: string;
  /** Empty when the source declared no path variable the URL names. */
  pathParams: PathParam[];
}

/**
 * Read a Postman URL. The string form passes through; the object form
 * takes `raw` (the documented canonical form) or, when `raw` is
 * absent, rebuilds the URL from its structured parts. `:name` segments
 * stay in the URL — they are path parameters by the one grammar — and
 * `variable[]` becomes their rows: a straight import is lossless and
 * records no note. A variable the URL does not name drops with a note;
 * a disabled one imports enabled with a note (a parameter named in the
 * URL is always sent).
 */
export function buildUrl(url: PostmanUrl | string | undefined, jsonPath: string, report: ImportReport): PostmanReadUrl {
  if (typeof url === 'string') return { url, pathParams: [] };
  if (!url || typeof url !== 'object') {
    // The request itself IS imported — an unset URL is a placeholder
    // to fill in the editor, not a loss.
    recordTransform(report, {
      path: `${jsonPath}.request.url`,
      from: 'request without a URL',
      to: 'imported with an empty URL',
      reason: 'The source request has no URL yet — the request was imported as-is; add the URL in the editor.',
    });
    return { url: '', pathParams: [] };
  }
  const text = typeof url.raw === 'string' && url.raw.length > 0 ? url.raw : buildStructuredUrl(url);
  return { url: text, pathParams: readPathVariables(text, url.variable, jsonPath, report) };
}

/**
 * The fallback for exports where `raw` is missing. A `path[]` entry is
 * a literal segment string (a `":id"` string is a path variable as
 * typed) or a path-variable object `{type: 'path', value: 'id'}`,
 * which rebuilds as the `:id` segment.
 */
function buildStructuredUrl(url: PostmanUrl): string {
  const protocol = url.protocol ?? 'https';
  const host = Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '');
  const port = url.port ? `:${url.port}` : '';
  const path = Array.isArray(url.path) ? `/${url.path.map(pathSegmentText).join('/')}` : (url.path ?? '');
  const query = Array.isArray(url.query)
    ? url.query
        .filter((q) => !q.disabled && q.key)
        .map((q) => `${encodeURIComponent(q.key ?? '')}=${encodeURIComponent(q.value ?? '')}`)
        .join('&')
    : '';
  const queryStr = query.length > 0 ? `?${query}` : '';
  return `${protocol}://${host}${port}${path}${queryStr}`;
}

function pathSegmentText(segment: string | { type?: string; value?: string }): string {
  if (typeof segment === 'string') return segment;
  const value = typeof segment.value === 'string' ? segment.value : '';
  return segment.type === 'path' ? `:${value}` : value;
}

function readPathVariables(
  url: string,
  variables: PostmanUrl['variable'],
  jsonPath: string,
  report: ImportReport,
): PathParam[] {
  if (!Array.isArray(variables) || variables.length === 0) return [];
  const named = new Set(parsePathParamNames(url).map((p) => p.name));
  const rows: PathParam[] = [];
  const seen = new Set<string>();
  variables.forEach((v, i) => {
    if (!v || typeof v !== 'object' || typeof v.key !== 'string' || v.key === '') return;
    const key = v.key;
    const variablePath = `${jsonPath}.request.url.variable[${i}]`;
    if (!named.has(key)) {
      recordDrop(report, {
        path: variablePath,
        reason: `Path variable ":${key}" is not named by the URL — nothing to substitute; dropped.`,
        names: [key],
      });
      return;
    }
    if (seen.has(key)) {
      recordDrop(report, {
        path: variablePath,
        reason: `Path variable ":${key}" is declared twice — the first declaration imported; this one dropped.`,
        names: [key],
      });
      return;
    }
    seen.add(key);
    if (v.disabled === true) {
      recordTransform(report, {
        path: variablePath,
        from: `disabled path variable :${key}`,
        to: 'imported enabled',
        reason:
          'A parameter named in the URL is always sent — the row imported enabled; remove the segment from the URL to drop it.',
      });
    }
    const description = textOf(v.description);
    rows.push({
      uid: generateUid(),
      key,
      value: valueText(v.value),
      ...(description !== undefined && description !== '' ? { description } : {}),
    });
  });
  return rows;
}

/** Postman types a variable's value (`type: number | boolean`) but
 *  stores it as its text; a typed scalar arriving raw stringifies. */
function valueText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function textOf(raw: string | { content?: string } | undefined): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.content === 'string') return raw.content;
  return undefined;
}

export function splitUrl(raw: string): { base: string; params: QueryParam[] } {
  if (!raw) return { base: '', params: [] };
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
