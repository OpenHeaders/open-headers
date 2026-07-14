/**
 * Network → SearchDoc projection.
 *
 * The main thread projects inspector rows into flat searchable docs;
 * the worker never sees `InspectorRow`/HAR shapes. The projection is
 * versioned by the row's `lifecycle` REFERENCE: the panel's reducers
 * replace a lifecycle object only when its data changed (identity-churn
 * law), so reference equality is an exact "searchable text unchanged"
 * test — `SearchClient` skips re-building and re-shipping such rows,
 * which is what makes repeat searches on a settled capture free of the
 * per-submit full-capture structured clone that used to dominate
 * (30–60 s on Firefox for large captures).
 */

import type { InspectorRow } from '../inspector-facet';
import { currentHarEntry, currentResponseBody } from '../inspector-row-projection';
import { SECTION, type SearchDoc, type SearchDocInput, type SearchDocSection } from './search-doc';

export function networkDocId(requestId: string): string {
  return `net:${requestId}`;
}

function extractFilename(url: string): { filename: string; origin: string } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const filename = segments.length > 0 ? segments[segments.length - 1] : parsed.hostname;
    return { filename, origin: parsed.hostname + parsed.pathname };
  } catch {
    return { filename: url, origin: url };
  }
}

/** The row's searchable plain-text sections, in scan order. */
export function buildSearchableText(row: InspectorRow): SearchDocSection[] {
  const parts: SearchDocSection[] = [];
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);

  const general = [lc.url, `${lc.method} ${lc.statusCode ?? ''} ${lc.statusText ?? ''}`].join('\n');
  parts.push({ text: general, name: SECTION.General });

  const reqHeaders = har?.request?.headers;
  if (reqHeaders && reqHeaders.length > 0) {
    parts.push({
      text: reqHeaders.map((h) => `${h.name}: ${h.value}`).join('\n'),
      name: SECTION.RequestHeaders,
    });
  }

  const resHeaders = har?.response?.headers;
  if (resHeaders && resHeaders.length > 0) {
    parts.push({
      text: resHeaders.map((h) => `${h.name}: ${h.value}`).join('\n'),
      name: SECTION.ResponseHeaders,
    });
  }

  const qs = har?.request?.queryString;
  if (qs && qs.length > 0) {
    parts.push({
      text: qs.map((q) => `${q.name}=${q.value}`).join('\n'),
      name: SECTION.QueryParams,
    });
  }

  const postData = har?.request?.postData;
  if (postData?.text) {
    parts.push({ text: postData.text, name: SECTION.RequestBody });
  }

  const body = currentResponseBody(lc);
  if (body?.content) {
    parts.push({ text: body.content, name: SECTION.Response });
  }

  return parts;
}

export function projectNetworkDoc(row: InspectorRow): SearchDoc {
  const lc = row.lifecycle;
  const { filename, origin } = extractFilename(lc.url);
  return {
    docId: networkDocId(lc.requestId),
    source: 'network',
    target: { kind: 'request', requestId: lc.requestId },
    displayId: row.displayId,
    filename,
    origin,
    timestamp: lc.startedAtMs,
    sections: buildSearchableText(row),
  };
}

/** Sync inputs for the current row set — versioned by lifecycle reference. */
export function networkDocInputs(rows: readonly InspectorRow[]): SearchDocInput[] {
  return rows.map((row) => ({
    docId: networkDocId(row.lifecycle.requestId),
    source: 'network' as const,
    version: row.lifecycle,
    build: () => projectNetworkDoc(row),
  }));
}
