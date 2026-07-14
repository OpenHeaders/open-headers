import type { QueryParam } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordTransform } from '../report';
import type { PostmanUrl } from './types';

// ── URL handling ────────────────────────────────────────────────────

export function buildUrl(url: PostmanUrl | string | undefined, jsonPath: string, report: ImportReport): string {
  if (typeof url === 'string') return url;
  if (!url || typeof url !== 'object') {
    // The request itself IS imported — an unset URL is a placeholder
    // to fill in the editor, not a loss.
    recordTransform(report, {
      path: `${jsonPath}.request.url`,
      from: 'request without a URL',
      to: 'imported with an empty URL',
      reason: 'The source request has no URL yet — the request was imported as-is; add the URL in the editor.',
    });
    return '';
  }
  if (typeof url.raw === 'string' && url.raw.length > 0) {
    // Path variables: `{{foo}}` in raw stays literal so the destination
    // resolver can fill it. `:foo` in the path is Postman's own
    // placeholder syntax — substitute from `variable[]` if present.
    return substitutePathVars(url.raw, url.variable, jsonPath, report);
  }
  // Build from structured parts. This is the fallback for exports
  // where `raw` is missing.
  const protocol = url.protocol ?? 'https';
  const host = Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '');
  const port = url.port ? `:${url.port}` : '';
  const path = Array.isArray(url.path) ? `/${url.path.join('/')}` : (url.path ?? '');
  const query = Array.isArray(url.query)
    ? url.query
        .filter((q) => !q.disabled && q.key)
        .map((q) => `${encodeURIComponent(q.key ?? '')}=${encodeURIComponent(q.value ?? '')}`)
        .join('&')
    : '';
  const queryStr = query.length > 0 ? `?${query}` : '';
  return `${protocol}://${host}${port}${path}${queryStr}`;
}

function substitutePathVars(
  raw: string,
  variables: PostmanUrl['variable'],
  jsonPath: string,
  report: ImportReport,
): string {
  if (!Array.isArray(variables) || variables.length === 0) return raw;
  let out = raw;
  const substituted: string[] = [];
  for (const v of variables) {
    if (!v.key) continue;
    const pattern = new RegExp(`:${escapeRegExp(v.key)}(?![a-zA-Z0-9_])`, 'g');
    const next = out.replace(pattern, encodeURIComponent(v.value ?? ''));
    if (next !== out) substituted.push(`:${v.key}`);
    out = next;
  }
  if (substituted.length > 0) {
    // A lossless automatic conversion — the source's own values were
    // inlined, so the URL sends identical bytes. Recorded so no
    // rewrite is silent.
    recordTransform(report, {
      path: `${jsonPath}.request.url`,
      from: `path variable${substituted.length === 1 ? '' : 's'} ${substituted.join(', ')}`,
      to: 'inline values',
      reason: 'Path-variable placeholders were filled from their own stored values — nothing to do.',
    });
  }
  return out;
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
