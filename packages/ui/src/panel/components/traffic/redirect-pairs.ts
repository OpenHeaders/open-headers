/**
 * Redirect-target → source pairing.
 *
 * A 3xx response in the panel is represented as its own row carrying the
 * `Location` header in `harEntry.response.redirectURL`. The browser then
 * issues a follow-up request to that URL; that follow-up is a separate
 * row, but Chrome's Network panel pairs the two by showing the source's
 * status code (e.g. `301`) as a clickable link in the follow-up's
 * Initiator column. Clicking jumps back to the source row.
 *
 * We mirror that pairing here. For every entry that has a prior entry
 * whose `response.redirectURL` matches its URL, we map the follower to
 * the source. When both rows carry a `chromeRequestId`, we additionally
 * require them to match — Chrome reuses the requestId across a redirect
 * chain, so this disambiguates unrelated requests that happen to share
 * a URL (e.g. polling).
 */

import type { InspectorRequest } from '../../data/types';

export type RedirectIndex = ReadonlyMap<string, { sourceId: string; sourceStatus: number }>;

function redirectTargetUrl(entry: InspectorRequest): string | null {
  const url = entry.harEntry.response?.redirectURL;
  return typeof url === 'string' && url ? url : null;
}

function isRedirectStatus(status: number | undefined): status is number {
  return typeof status === 'number' && status >= 300 && status < 400;
}

export function deriveRedirectPairs(entries: readonly InspectorRequest[]): RedirectIndex {
  // Direct lookup by `chromeRequestId`. Chrome's CDP and webRequest both
  // reuse the same requestId across an entire redirect chain — each hop
  // (source 3xx → next source 3xx → final 2xx) carries the same id. So
  // a follower's source is exactly the prior entry in its requestId
  // group whose `response.redirectURL` matches the follower's URL.
  const byRequestId = new Map<string, InspectorRequest[]>();
  for (const e of entries) {
    if (!e.chromeRequestId) continue;
    let group = byRequestId.get(e.chromeRequestId);
    if (!group) {
      group = [];
      byRequestId.set(e.chromeRequestId, group);
    }
    group.push(e);
  }
  for (const group of byRequestId.values()) {
    group.sort((a, b) => a.arrivalIndex - b.arrivalIndex);
  }

  const out = new Map<string, { sourceId: string; sourceStatus: number }>();
  for (const group of byRequestId.values()) {
    for (let i = 0; i < group.length; i++) {
      const follower = group[i];
      // The source for this follower is the most recent prior hop in
      // the same requestId group whose Location pointed here.
      for (let j = i - 1; j >= 0; j--) {
        const candidate = group[j];
        if (!isRedirectStatus(candidate.statusCode)) continue;
        if (candidate.harEntry.response?.redirectURL !== follower.url) continue;
        out.set(follower.id, { sourceId: candidate.id, sourceStatus: candidate.statusCode });
        break;
      }
    }
  }
  return out;
}
