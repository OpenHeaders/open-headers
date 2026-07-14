/**
 * Saved responses → Response Example payloads.
 *
 * `item.response[]` carries one exchange snapshot per entry: `name`,
 * `originalRequest` (the request shape as sent — the wire never puts
 * an auth config here, matching the ResponseExample schema's auth
 * exclusion), the status phrase in `status` with the numeric code in
 * `code`, response `header` rows, the body text, and — on Data API
 * payloads — a `createdAt` capture moment. Entries without `createdAt`
 * (file exports) emit no `capturedAt`; the caller supplies its import
 * timestamp when minting the entity, keeping this parser clock-free.
 *
 * Silently ignored wire fields, all lossless: `id` / `uid` /
 * `updatedAt` (vendor bookkeeping, not exchange data),
 * `_postman_previewlanguage` (a display hint — presentation derives
 * from the Content-Type header and body text, both preserved), and
 * `responseTime: null` (the vendor's own "not recorded" marker).
 */

import type { CapturedRequest } from '../../types/response-example';
import { type ImportReport, recordDrop } from '../report';
import { buildHeaders } from './auth';
import { buildBody } from './body';
import { coerceMethod } from './method';
import type { PostmanParsedExample, PostmanRequest, PostmanSavedResponse } from './types';
import { buildUrl, splitUrl } from './url';

export function buildExamples(
  responses: PostmanSavedResponse[],
  parentShape: CapturedRequest,
  jsonPath: string,
  report: ImportReport,
): PostmanParsedExample[] {
  const examples: PostmanParsedExample[] = [];
  for (let i = 0; i < responses.length; i++) {
    const entry = responses[i];
    const entryPath = `${jsonPath}.response[${i}]`;
    if (!entry || typeof entry !== 'object') {
      recordDrop(report, {
        path: entryPath,
        reason: 'Saved response is not an object — skipped.',
        tracking: 'PERMANENT: Postman shape validation',
      });
      continue;
    }
    examples.push(convertSavedResponse(entry, parentShape, entryPath, report));
  }
  return examples;
}

function convertSavedResponse(
  entry: PostmanSavedResponse,
  parentShape: CapturedRequest,
  entryPath: string,
  report: ImportReport,
): PostmanParsedExample {
  const name = (typeof entry.name === 'string' ? entry.name : '').trim() || 'Saved Response';
  const { request, fullUrl } = capturedRequestOf(entry.originalRequest, parentShape, entryPath, report);
  if (Array.isArray(entry.cookie) && entry.cookie.length > 0) {
    recordDrop(report, {
      path: `${entryPath}.cookie`,
      reason: `${entry.cookie.length} cookie row${entry.cookie.length === 1 ? '' : 's'} not imported — the example schema records the exchange without wire-capture internals; Set-Cookie response headers import as-is.`,
      tracking: 'PERMANENT: ResponseExample schema excludes wire capture',
    });
  }
  const body = typeof entry.body === 'string' ? entry.body : '';
  return {
    name,
    ...(typeof entry.createdAt === 'string' && entry.createdAt.length > 0 ? { capturedAt: entry.createdAt } : {}),
    request,
    response: {
      status: typeof entry.code === 'number' && Number.isFinite(entry.code) ? entry.code : 0,
      statusText: typeof entry.status === 'string' ? entry.status : '',
      // The wire carries no final URL — the captured request's own is
      // the truthful stand-in (redirect-free as documented).
      url: fullUrl,
      headers: responseHeadersOf(entry.header, entryPath, report),
      body,
      bodyTruncated: false,
      bodyBytes: new TextEncoder().encode(body).length,
      durationMs:
        typeof entry.responseTime === 'number' && Number.isFinite(entry.responseTime) ? entry.responseTime : 0,
    },
  };
}

/**
 * Convert `originalRequest` through the same URL/header/body builders
 * the request path uses. Authorization header rows stay verbatim —
 * the captured shape has no auth slot to promote into, mirroring the
 * product's own Save Response (authored rows persist as sent). A
 * snapshot without `originalRequest` falls back to the request the
 * example hangs under — the shape the vendor UI displays for it too.
 */
function capturedRequestOf(
  orig: PostmanRequest | undefined,
  parentShape: CapturedRequest,
  entryPath: string,
  report: ImportReport,
): { request: CapturedRequest; fullUrl: string } {
  if (!orig || typeof orig !== 'object') {
    return { request: parentShape, fullUrl: parentShape.url };
  }
  const method = coerceMethod(orig.method, entryPath, report);
  const headers = buildHeaders(orig.header ?? [], entryPath, report);
  const fullUrl = buildUrl(orig.url, entryPath, report);
  const body = buildBody(orig.body, headers, entryPath, report);
  const { base, params } = splitUrl(fullUrl);
  return { request: { method, url: base, headers, params, body }, fullUrl };
}

function responseHeadersOf(
  header: PostmanSavedResponse['header'],
  entryPath: string,
  report: ImportReport,
): Array<{ key: string; value: string }> {
  if (Array.isArray(header)) {
    const rows: Array<{ key: string; value: string }> = [];
    for (const h of header) {
      if (!h || typeof h.key !== 'string' || h.key.trim().length === 0) continue;
      rows.push({ key: h.key, value: typeof h.value === 'string' ? h.value : '' });
    }
    return rows;
  }
  if (typeof header === 'string' && header.trim().length > 0) {
    recordDrop(report, {
      path: `${entryPath}.header`,
      reason: 'Response headers as a raw text block are not parsed — headers import from the structured form only.',
      tracking: 'PERMANENT: Postman shape validation',
    });
  }
  return [];
}
